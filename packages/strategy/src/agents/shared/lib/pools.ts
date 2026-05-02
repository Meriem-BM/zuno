import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import type { Address, ChainId, Pool, Token } from "@zuno/core";
import { chainConfig } from "@zuno/chain/config";
import { TOKEN_WHITELIST } from "@zuno/chain/tokens";
import {
  buildPoolKey,
  poolIdFor,
  publicClient,
  STATE_VIEW_ABI,
} from "@zuno/chain/uniswap";
import { tickToPrice } from "@zuno/chain/uniswap";

// Real, dynamic pool discovery for v4.
//
// Algorithm: enumerate (token0, token1, feeTier) from TOKEN_WHITELIST with
// canonical ordering and hooks=0x0, compute the deterministic pool id, then
// probe StateView.getSlot0 + getLiquidity. Initialized + non-zero liquidity
// pools surface; everything else drops out. Cache at
// ~/.zuno/pools-{chainId}.json with a 30-min TTL.
//
// Pool addresses are never stored - they're recomputed from the PoolKey, so
// "discovery" is the chain telling us which pools exist right now.

export const STANDARD_FEE_TIERS: readonly number[] = [100, 500, 3000, 10000];

export interface PoolEntry {
  poolManager: Address;
  poolId: `0x${string}`;
  pool: Pool;
}

export interface DiscoverOptions {
  refresh?: boolean;
}

export interface DiscoverFilter {
  // Order-insensitive match on token symbols.
  pinnedPair?: { token0Symbol: string; token1Symbol: string };
  pinnedFeeTier?: number;
  containingToken?: string;
}

export async function discoverPools(
  chainId: ChainId,
  filter: DiscoverFilter = {},
  options: DiscoverOptions = {},
): Promise<PoolEntry[]> {
  const all = options.refresh ? await readChain(chainId) : await readWithCache(chainId);
  return applyFilter(all, filter);
}

export async function refreshPoolsCache(chainId: ChainId): Promise<PoolEntry[]> {
  const fresh = await readChain(chainId);
  await writeCache(chainId, fresh);
  return fresh;
}

// === Cache layer ===

const CACHE_TTL_MS = 30 * 60 * 1000;

interface CacheFile {
  fetchedAt: number;
  chainId: ChainId;
  entries: SerializedPoolEntry[];
}

interface SerializedPoolEntry {
  poolManager: Address;
  poolId: string;
  pool: Pool;
}

function cachePath(chainId: ChainId): string {
  const dir = process.env.ZUNO_POOL_CACHE_DIR?.trim() || join(homedir(), ".zuno");
  return join(dir, `pools-${chainId}.json`);
}

async function readWithCache(chainId: ChainId): Promise<PoolEntry[]> {
  const path = cachePath(chainId);
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as CacheFile;
    if (parsed.chainId !== chainId) throw new Error("cache chain mismatch");
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) throw new Error("expired");
    return parsed.entries.map((e) => ({
      poolManager: e.poolManager,
      poolId: e.poolId as `0x${string}`,
      pool: e.pool,
    }));
  } catch {
    const fresh = await readChain(chainId);
    await writeCache(chainId, fresh).catch(() => {});
    return fresh;
  }
}

async function writeCache(chainId: ChainId, entries: PoolEntry[]): Promise<void> {
  const path = cachePath(chainId);
  const dir = path.slice(0, path.lastIndexOf("/"));
  await mkdir(dir, { recursive: true });
  const payload: CacheFile = {
    fetchedAt: Date.now(),
    chainId,
    entries: entries.map((e) => ({
      poolManager: e.poolManager,
      poolId: e.poolId,
      pool: e.pool,
    })),
  };
  // Atomic write: temp file + rename so a concurrent reader never sees half a file.
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
  await rename(tmp, path);
}

// === On-chain probing ===

interface CandidateKey {
  token0: Token;
  token1: Token;
  feeTier: number;
  poolId: `0x${string}`;
}

async function readChain(chainId: ChainId): Promise<PoolEntry[]> {
  const tokens = TOKEN_WHITELIST[chainId] ?? [];
  if (tokens.length < 2) return [];

  const candidates = enumerateCandidates(tokens);
  if (candidates.length === 0) return [];

  const cfg = chainConfig(chainId);
  const client = publicClient(chainId);

  // Probe every candidate via Promise.all - cheap on testnet (12 keys × 2 reads).
  // Each result tuple is [slot0, liquidity] or [null, null] on rejection.
  const probes = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const [slot0, liquidity] = await Promise.all([
          client.readContract({
            address: cfg.stateView,
            abi: STATE_VIEW_ABI,
            functionName: "getSlot0",
            args: [candidate.poolId],
          }) as Promise<readonly [bigint, number, number, number]>,
          client.readContract({
            address: cfg.stateView,
            abi: STATE_VIEW_ABI,
            functionName: "getLiquidity",
            args: [candidate.poolId],
          }) as Promise<bigint>,
        ]);
        return { candidate, slot0, liquidity };
      } catch {
        return null;
      }
    }),
  );

  const entries: PoolEntry[] = [];
  for (const probe of probes) {
    if (!probe) continue;
    const [sqrtPriceX96, currentTick] = probe.slot0;
    if (sqrtPriceX96 <= 0n) continue; // not initialized
    if (probe.liquidity <= 0n) continue; // initialized but no liquidity - useless to LP into
    const { candidate } = probe;
    const pool: Pool = {
      address: cfg.poolManager,
      chainId,
      token0: candidate.token0,
      token1: candidate.token1,
      feeTier: candidate.feeTier,
      tickSpacing: tickSpacingForFee(candidate.feeTier),
      currentTick: Number(currentTick),
      sqrtPriceX96: sqrtPriceX96.toString(),
      liquidity: probe.liquidity.toString(),
      price: tickToPrice(
        Number(currentTick),
        candidate.token0.decimals,
        candidate.token1.decimals,
      ),
    };
    entries.push({
      poolManager: cfg.poolManager,
      poolId: candidate.poolId,
      pool,
    });
  }

  // Rank by liquidity descending - testnet-friendly proxy for "popularity".
  entries.sort((a, b) => {
    const la = BigInt(a.pool.liquidity);
    const lb = BigInt(b.pool.liquidity);
    if (lb > la) return 1;
    if (lb < la) return -1;
    return 0;
  });
  return entries;
}

function enumerateCandidates(tokens: Token[]): CandidateKey[] {
  const out: CandidateKey[] = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const a = tokens[i]!;
      const b = tokens[j]!;
      const aLower = a.address.toLowerCase();
      const bLower = b.address.toLowerCase();
      const [token0, token1] = aLower < bLower ? [a, b] : [b, a];
      for (const fee of STANDARD_FEE_TIERS) {
        const { poolKey } = buildPoolKey(token0.address, token1.address, fee);
        out.push({
          token0,
          token1,
          feeTier: fee,
          poolId: poolIdFor(poolKey),
        });
      }
    }
  }
  return out;
}

function tickSpacingForFee(fee: number): number {
  switch (fee) {
    case 100:
      return 1;
    case 500:
      return 10;
    case 3000:
      return 60;
    case 10000:
      return 200;
    default:
      return Math.max(1, Math.floor(fee / 100));
  }
}

// === Filtering ===

function applyFilter(entries: PoolEntry[], filter: DiscoverFilter): PoolEntry[] {
  return entries.filter((e) => {
    if (filter.pinnedFeeTier !== undefined && e.pool.feeTier !== filter.pinnedFeeTier) return false;
    if (filter.pinnedPair) {
      const t0 = e.pool.token0.symbol.toLowerCase();
      const t1 = e.pool.token1.symbol.toLowerCase();
      const a = filter.pinnedPair.token0Symbol.toLowerCase();
      const b = filter.pinnedPair.token1Symbol.toLowerCase();
      const matches = (t0 === a && t1 === b) || (t0 === b && t1 === a);
      if (!matches) return false;
    }
    if (filter.containingToken) {
      const want = filter.containingToken.toLowerCase();
      // Treat ETH and WETH as equivalent on EVM chains (LP exposure target).
      const aliases = want === "eth" ? ["eth", "weth"] : [want];
      const t0 = e.pool.token0.symbol.toLowerCase();
      const t1 = e.pool.token1.symbol.toLowerCase();
      const matches = aliases.includes(t0) || aliases.includes(t1);
      if (!matches) return false;
    }
    return true;
  });
}
