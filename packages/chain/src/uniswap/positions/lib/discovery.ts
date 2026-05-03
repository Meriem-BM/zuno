import { chainConfig, viemChainFor } from "@zuno/chain/config";
import type { Address, ChainId, Position } from "@zuno/core";
import { createPublicClient, http, parseAbiItem } from "viem";
import { POSITION_MANAGER_ABI } from "./constants.js";

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);
const LOG_CHUNK_BLOCKS = 9_000n;
const LOOKBACK_BLOCKS = 200_000n;
const RECENT_TOKEN_SCAN = 5_000n;
const OWNER_READ_BATCH = 10n;

export type PositionReadClient = {
  readContract: (args: {
    address: Address;
    abi: typeof POSITION_MANAGER_ABI;
    functionName: string;
    args: readonly unknown[];
  }) => Promise<unknown>;
};

export type PositionDiscoveryClient = PositionReadClient & {
  getBlockNumber?: () => Promise<bigint>;
  getLogs?: (args: {
    address: Address;
    event: typeof TRANSFER_EVENT;
    args: { to: Address };
    fromBlock: bigint;
    toBlock: bigint;
  }) => Promise<Array<{ args?: { tokenId?: bigint } }>>;
};

export class PositionDetailsReadError extends Error {
  readonly tokenIds: readonly string[];
  readonly positions: readonly Position[];

  constructor(tokenIds: readonly bigint[], positions: readonly Position[] = []) {
    const total = tokenIds.length + positions.length;
    super(
      `position discovery found ${total} token id${total === 1 ? "" : "s"}, but RPC reads for ${tokenIds.length} position detail${tokenIds.length === 1 ? "" : "s"} failed`,
    );
    this.name = "PositionDetailsReadError";
    this.tokenIds = tokenIds.map((id) => id.toString());
    this.positions = positions;
  }
}

export async function ownedTokenIds(
  chainId: ChainId,
  contract: Address,
  owner: Address,
  client?: PositionDiscoveryClient,
): Promise<bigint[]> {
  const viemClient =
    client ??
    createPublicClient({
      chain: viemChainFor(chainId),
      transport: http(chainConfig(chainId).rpcUrl),
    });
  const discoveryClient = viemClient as unknown as PositionDiscoveryClient;
  const readClient = discoveryClient as PositionReadClient;
  const balance = await ownedBalance(readClient, contract, owner);
  if (balance === 0n) return [];

  const byRecentIds = await scanRecentOwnedTokenIds(
    readClient,
    contract,
    owner,
    balance ?? undefined,
  );
  if (byRecentIds.length > 0) return byRecentIds;

  if (!discoveryClient.getBlockNumber || !discoveryClient.getLogs) {
    throw new Error("position discovery incomplete: RPC could not confirm owned token ids");
  }

  const head = await readHead(discoveryClient);
  const ranges = logRanges(head);
  const candidates = await collectTransferTokenIds(discoveryClient, contract, owner, ranges);

  if (candidates.length === 0) {
    return retryRecentScanOrThrow(
      readClient,
      contract,
      owner,
      balance,
      "no token ids could be confirmed",
    );
  }

  const byLogs = await verifyOwnedTokenIds(readClient, contract, owner, candidates);
  if (byLogs.length > 0) return byLogs;

  return retryRecentScanOrThrow(
    readClient,
    contract,
    owner,
    balance,
    "candidate token ids could not be verified",
  );
}

async function readHead(client: PositionDiscoveryClient): Promise<bigint> {
  try {
    return await client.getBlockNumber!();
  } catch {
    throw new Error("position discovery incomplete: RPC block-number read failed");
  }
}

function logRanges(head: bigint): Array<{ from: bigint; to: bigint }> {
  const fromCeiling = head > LOOKBACK_BLOCKS ? head - LOOKBACK_BLOCKS : 0n;
  const ranges: Array<{ from: bigint; to: bigint }> = [];
  for (let from = fromCeiling; from <= head; from += LOG_CHUNK_BLOCKS + 1n) {
    const to = from + LOG_CHUNK_BLOCKS > head ? head : from + LOG_CHUNK_BLOCKS;
    ranges.push({ from, to });
  }
  return ranges;
}

async function collectTransferTokenIds(
  client: PositionDiscoveryClient,
  contract: Address,
  owner: Address,
  ranges: ReadonlyArray<{ from: bigint; to: bigint }>,
): Promise<bigint[]> {
  const ids = new Set<bigint>();
  for (const { from, to } of ranges) {
    try {
      const logs = await client.getLogs!({
        address: contract,
        event: TRANSFER_EVENT,
        args: { to: owner },
        fromBlock: from,
        toBlock: to,
      });
      for (const log of logs) {
        const id = log.args?.tokenId;
        if (typeof id === "bigint") ids.add(id);
      }
    } catch {
      continue;
    }
  }
  return Array.from(ids);
}

async function retryRecentScanOrThrow(
  client: PositionReadClient,
  contract: Address,
  owner: Address,
  balance: bigint | null,
  reason: string,
): Promise<bigint[]> {
  const tokenIds = await scanRecentOwnedTokenIds(client, contract, owner, balance ?? undefined);
  if (tokenIds.length > 0 || balance === 0n) return tokenIds;
  throw new Error(`position discovery incomplete: ${reason}`);
}

async function verifyOwnedTokenIds(
  client: PositionReadClient,
  contract: Address,
  owner: Address,
  tokenIds: readonly bigint[],
): Promise<bigint[]> {
  const verified: bigint[] = [];
  await Promise.all(
    [...new Set(tokenIds)].map(async (tokenId) => {
      try {
        const current = (await client.readContract({
          address: contract,
          abi: POSITION_MANAGER_ABI,
          functionName: "ownerOf",
          args: [tokenId],
        })) as Address;
        if (sameAddress(current, owner)) verified.push(tokenId);
      } catch {
        return;
      }
    }),
  );
  return sortTokenIds(verified);
}

async function ownedBalance(
  client: PositionReadClient,
  contract: Address,
  owner: Address,
): Promise<bigint | null> {
  try {
    return (await client.readContract({
      address: contract,
      abi: POSITION_MANAGER_ABI,
      functionName: "balanceOf",
      args: [owner],
    })) as bigint;
  } catch {
    return null;
  }
}

async function scanRecentOwnedTokenIds(
  client: PositionReadClient,
  contract: Address,
  owner: Address,
  knownBalance?: bigint,
): Promise<bigint[]> {
  let balance: bigint | null;
  let nextTokenId: bigint;
  try {
    balance = knownBalance ?? (await ownedBalance(client, contract, owner));
    nextTokenId = (await client.readContract({
      address: contract,
      abi: POSITION_MANAGER_ABI,
      functionName: "nextTokenId",
      args: [],
    })) as bigint;
  } catch {
    return [];
  }
  if (balance === 0n || nextTokenId <= 0n) return [];

  const found: bigint[] = [];
  const lowerBound = nextTokenId > RECENT_TOKEN_SCAN ? nextTokenId - RECENT_TOKEN_SCAN : 1n;
  let upper = nextTokenId - 1n;
  while (upper >= lowerBound) {
    const lower =
      upper - (OWNER_READ_BATCH - 1n) > lowerBound ? upper - (OWNER_READ_BATCH - 1n) : lowerBound;
    const ownedInBatch = await readOwnedBatch(client, contract, owner, lower, upper);

    for (const tokenId of ownedInBatch) {
      found.push(tokenId);
      if (balance !== null && BigInt(found.length) >= balance) {
        return sortTokenIds(found);
      }
    }
    if (lower === lowerBound) break;
    upper = lower - 1n;
  }
  return sortTokenIds(found);
}

async function readOwnedBatch(
  client: PositionReadClient,
  contract: Address,
  owner: Address,
  lower: bigint,
  upper: bigint,
): Promise<bigint[]> {
  const tokenIds: bigint[] = [];
  for (let tokenId = upper; tokenId >= lower; tokenId -= 1n) tokenIds.push(tokenId);

  const owned = await Promise.all(
    tokenIds.map(async (tokenId) => {
      try {
        const current = (await client.readContract({
          address: contract,
          abi: POSITION_MANAGER_ABI,
          functionName: "ownerOf",
          args: [tokenId],
        })) as Address;
        return sameAddress(current, owner) ? tokenId : undefined;
      } catch {
        return undefined;
      }
    }),
  );
  return owned.filter((tokenId): tokenId is bigint => tokenId !== undefined);
}

function sameAddress(a: Address, b: Address): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function sortTokenIds(tokenIds: readonly bigint[]): bigint[] {
  return [...tokenIds].sort((a, b) => (a < b ? -1 : 1));
}
