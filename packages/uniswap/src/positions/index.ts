import { chainConfig } from "@zuno/config";
import type { Address, ChainId, Position, PositionSnapshot, RangeReport, Token } from "@zuno/core";
import { createPublicClient, http, isAddress } from "viem";
import { arbitrum, base, mainnet, optimism } from "viem/chains";
import { distanceFromBoundary, inRange, tickToPrice, utilization } from "../math/tick-math.js";

export interface PositionReadOptions {
  chainId?: ChainId;
  owner?: Address;
  client?: ContractReader;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export interface ContractReader {
  readContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
}

const NFPM_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "nonce", type: "uint96" },
      { name: "operator", type: "address" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
      { name: "tokensOwed0", type: "uint128" },
      { name: "tokensOwed1", type: "uint128" },
    ],
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

const FACTORY_ABI = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
] as const;

const POOL_ABI = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "liquidity",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint128" }],
  },
] as const;

export async function getPosition(
  id: string,
  options: PositionReadOptions = {},
): Promise<Position> {
  const tokenId = parseTokenId(id);
  const chain = chainConfig(options.chainId);
  const client = options.client ?? publicClient(chain.id);

  if (options.owner) {
    const actualOwner = await client.readContract({
      address: chain.nonfungiblePositionManager,
      abi: NFPM_ABI,
      functionName: "ownerOf",
      args: [tokenId],
    });
    if (String(actualOwner).toLowerCase() !== options.owner.toLowerCase()) {
      throw new Error(`position ${id} is not owned by the watch address`);
    }
  }

  const raw = (await client.readContract({
    address: chain.nonfungiblePositionManager,
    abi: NFPM_ABI,
    functionName: "positions",
    args: [tokenId],
  })) as readonly unknown[];

  const token0Address = raw[2] as Address;
  const token1Address = raw[3] as Address;
  const feeTier = Number(raw[4]);
  const tickLower = Number(raw[5]);
  const tickUpper = Number(raw[6]);
  const liquidity = raw[7] as bigint;

  const [token0, token1] = await Promise.all([
    readToken(client, token0Address),
    readToken(client, token1Address),
  ]);

  const poolAddress = (await client.readContract({
    address: chain.uniswapV3Factory,
    abi: FACTORY_ABI,
    functionName: "getPool",
    args: [token0Address, token1Address, feeTier],
  })) as Address;
  if (!isAddress(poolAddress) || poolAddress === ZERO_ADDRESS) {
    throw new Error(`pool not found for position ${id}`);
  }

  const [slot0, poolLiquidity] = await Promise.all([
    client.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: "slot0",
    }),
    client.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: "liquidity",
    }),
  ]);

  const currentTick = Number((slot0 as readonly unknown[])[1]);
  const amounts = estimateAmounts(liquidity, currentTick, tickLower, tickUpper);

  return {
    id: tokenId.toString(),
    owner: options.owner ?? ZERO_ADDRESS,
    pool: {
      address: poolAddress,
      chainId: chain.id,
      token0,
      token1,
      feeTier,
      tickSpacing: tickSpacingForFee(feeTier),
      currentTick,
      sqrtPriceX96: String((slot0 as readonly unknown[])[0]),
      liquidity: String(poolLiquidity),
      price: tickToPrice(currentTick, token0.decimals, token1.decimals),
    },
    tickLower,
    tickUpper,
    liquidity: liquidity.toString(),
    amount0: amounts.amount0,
    amount1: amounts.amount1,
    feesOwed0: (raw[10] as bigint).toString(),
    feesOwed1: (raw[11] as bigint).toString(),
  };
}

export async function listPositions(
  owner: Address,
  options: PositionReadOptions = {},
): Promise<Position[]> {
  const chain = chainConfig(options.chainId);
  const client = options.client ?? publicClient(chain.id);
  const balance = await client.readContract({
    address: chain.nonfungiblePositionManager,
    abi: NFPM_ABI,
    functionName: "balanceOf",
    args: [owner],
  });

  const ids = await Promise.all(
    Array.from({ length: Number(balance) }, (_, i) =>
      client.readContract({
        address: chain.nonfungiblePositionManager,
        abi: NFPM_ABI,
        functionName: "tokenOfOwnerByIndex",
        args: [owner, BigInt(i)],
      }),
    ),
  );

  return Promise.all(
    ids.map((id) => getPosition(String(id), { ...options, owner, client, chainId: chain.id })),
  );
}

export function buildSnapshot(position: Position): PositionSnapshot {
  const { pool, tickLower, tickUpper } = position;
  const tick = pool.currentTick;
  const range: RangeReport = {
    inRange: inRange(tick, tickLower, tickUpper),
    distanceFromBoundary: distanceFromBoundary(tick, tickLower, tickUpper),
    utilization: utilization(tick, tickLower, tickUpper),
    priceLower: tickToPrice(tickLower, pool.token0.decimals, pool.token1.decimals),
    priceUpper: tickToPrice(tickUpper, pool.token0.decimals, pool.token1.decimals),
    priceCurrent: pool.price,
  };
  return { position, range, takenAt: Date.now() };
}

export function rangeStatus(snapshot: PositionSnapshot): "IN_RANGE" | "OUT_OF_RANGE" {
  return snapshot.range.inRange ? "IN_RANGE" : "OUT_OF_RANGE";
}

export function pairName(position: Position): string {
  return `${position.pool.token0.symbol}/${position.pool.token1.symbol}`;
}

export function isRiskyPosition(snapshot: PositionSnapshot): boolean {
  if (!snapshot.range.inRange) return true;
  return snapshot.range.utilization < 0.15 || snapshot.range.utilization > 0.85;
}

export function riskReason(snapshot: PositionSnapshot): string {
  if (!snapshot.range.inRange) return "out of range";
  const pct = (snapshot.range.utilization * 100).toFixed(0);
  return `near range boundary (${pct}% through current band)`;
}

function publicClient(chainId: ChainId): ContractReader {
  const cfg = chainConfig(chainId);
  const chain = {
    1: mainnet,
    10: optimism,
    8453: base,
    42161: arbitrum,
  }[chainId];
  return createPublicClient({
    chain,
    transport: http(cfg.rpcUrl),
  }) as unknown as ContractReader;
}

function parseTokenId(id: string): bigint {
  const raw = id.trim();
  if (!/^\d+$/u.test(raw)) throw new Error(`position id must be a numeric NFT token id: ${id}`);
  return BigInt(raw);
}

async function readToken(client: ContractReader, address: Address): Promise<Token> {
  const [symbol, decimals] = await Promise.all([
    client.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }),
    client.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }),
  ]);
  return { address, symbol: String(symbol), decimals: Number(decimals) };
}

function tickSpacingForFee(fee: number): number {
  const spacing: Record<number, number> = {
    100: 1,
    500: 10,
    3000: 60,
    10000: 200,
  };
  return spacing[fee] ?? 1;
}

function estimateAmounts(
  liquidity: bigint,
  currentTick: number,
  tickLower: number,
  tickUpper: number,
): { amount0: string; amount1: string } {
  const l = Number(liquidity);
  if (!Number.isFinite(l) || l <= 0) return { amount0: "0", amount1: "0" };

  const sqrtLower = Math.sqrt(Math.pow(1.0001, tickLower));
  const sqrtUpper = Math.sqrt(Math.pow(1.0001, tickUpper));
  const sqrtCurrent = Math.sqrt(Math.pow(1.0001, currentTick));

  let amount0 = 0;
  let amount1 = 0;
  if (currentTick <= tickLower) {
    amount0 = (l * (sqrtUpper - sqrtLower)) / (sqrtLower * sqrtUpper);
  } else if (currentTick < tickUpper) {
    amount0 = (l * (sqrtUpper - sqrtCurrent)) / (sqrtCurrent * sqrtUpper);
    amount1 = l * (sqrtCurrent - sqrtLower);
  } else {
    amount1 = l * (sqrtUpper - sqrtLower);
  }

  return {
    amount0: Math.max(0, Math.floor(amount0)).toString(),
    amount1: Math.max(0, Math.floor(amount1)).toString(),
  };
}
