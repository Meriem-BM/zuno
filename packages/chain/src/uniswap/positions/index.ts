import { chainConfig } from "@zuno/chain/config";
import type { Address, Position, PositionSnapshot, RangeReport } from "@zuno/core";
import { toHex } from "viem";
import {
  decodePositionInfo,
  estimateAmounts,
  parseTokenId,
  poolIdFor,
  publicClient,
  readToken,
} from "./lib/helpers.js";
import { POSITION_MANAGER_ABI, STATE_VIEW_ABI, ZERO_ADDRESS } from "./lib/constants.js";
import {
  ownedTokenIds,
  PositionDetailsReadError,
  type PositionDiscoveryClient,
} from "./lib/discovery.js";
import type { PositionReadOptions } from "./types.js";
import { distanceFromBoundary, inRange, tickToPrice, utilization } from "../math/tick-math.js";

export * from "./types.js";
export {
  buildPoolKey,
  liquidityForAmounts,
  poolIdFor,
  publicClient,
  type PoolKey,
} from "./lib/helpers.js";
export { STATE_VIEW_ABI, ZERO_ADDRESS } from "./lib/constants.js";
export { PositionDetailsReadError } from "./lib/discovery.js";

export async function getPosition(
  id: string,
  options: PositionReadOptions = {},
): Promise<Position> {
  const tokenId = parseTokenId(id);
  const chain = chainConfig(options.chainId);
  const client = options.client ?? publicClient(chain.id);

  const actualOwner = (await client.readContract({
    address: chain.positionManager,
    abi: POSITION_MANAGER_ABI,
    functionName: "ownerOf",
    args: [tokenId],
  })) as Address;
  if (options.owner && actualOwner.toLowerCase() !== options.owner.toLowerCase()) {
    throw new Error(`position ${id} is not owned by the configured wallet`);
  }

  const [poolResult, positionLiquidity] = await Promise.all([
    client.readContract({
      address: chain.positionManager,
      abi: POSITION_MANAGER_ABI,
      functionName: "getPoolAndPositionInfo",
      args: [tokenId],
    }),
    client.readContract({
      address: chain.positionManager,
      abi: POSITION_MANAGER_ABI,
      functionName: "getPositionLiquidity",
      args: [tokenId],
    }),
  ]);

  const [poolKeyRaw, positionInfoRaw] = poolResult as readonly [readonly unknown[], bigint];
  const poolKey = normalizePoolKey(poolKeyRaw);
  const { tickLower, tickUpper } = decodePositionInfo(positionInfoRaw);
  const poolId = poolIdFor(poolKey);

  const [slot0, poolLiquidity, positionState, feeGrowthInside] = await Promise.all([
    client.readContract({
      address: chain.stateView,
      abi: STATE_VIEW_ABI,
      functionName: "getSlot0",
      args: [poolId],
    }),
    client.readContract({
      address: chain.stateView,
      abi: STATE_VIEW_ABI,
      functionName: "getLiquidity",
      args: [poolId],
    }),
    client.readContract({
      address: chain.stateView,
      abi: STATE_VIEW_ABI,
      functionName: "getPositionInfo",
      args: [poolId, toHex(tokenId, { size: 32 })],
    }),
    client.readContract({
      address: chain.stateView,
      abi: STATE_VIEW_ABI,
      functionName: "getFeeGrowthInside",
      args: [poolId, tickLower, tickUpper],
    }),
  ]);

  const currentTick = Number((slot0 as readonly unknown[])[1]);
  const liquidity = positionLiquidity as bigint;
  const amounts = estimateAmounts(liquidity, currentTick, tickLower, tickUpper);
  const [token0, token1] = await Promise.all([
    readToken(client, poolKey.currency0, chain.id),
    readToken(client, poolKey.currency1, chain.id),
  ]);
  const [, last0, last1] = positionState as readonly [bigint, bigint, bigint];
  const [current0, current1] = feeGrowthInside as readonly [bigint, bigint];

  return {
    id: tokenId.toString(),
    owner: actualOwner ?? ZERO_ADDRESS,
    pool: {
      address: chain.poolManager,
      chainId: chain.id,
      token0,
      token1,
      feeTier: poolKey.fee,
      tickSpacing: poolKey.tickSpacing,
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
    feesOwed0: feeGrowthToAmount(liquidity, current0, last0).toString(),
    feesOwed1: feeGrowthToAmount(liquidity, current1, last1).toString(),
  };
}

function normalizePoolKey(raw: readonly unknown[] | Record<string, unknown>) {
  if (Array.isArray(raw)) {
    return {
      currency0: raw[0] as Address,
      currency1: raw[1] as Address,
      fee: Number(raw[2]),
      tickSpacing: Number(raw[3]),
      hooks: raw[4] as Address,
    };
  }
  const key = raw as Record<string, unknown>;
  return {
    currency0: key.currency0 as Address,
    currency1: key.currency1 as Address,
    fee: Number(key.fee),
    tickSpacing: Number(key.tickSpacing),
    hooks: key.hooks as Address,
  };
}

export async function listPositions(
  owner: Address,
  options: PositionReadOptions = {},
): Promise<Position[]> {
  const chain = chainConfig(options.chainId);
  const client = options.client ?? publicClient(chain.id);

  const owned = await ownedTokenIds(
    chain.id,
    chain.positionManager,
    owner,
    client as PositionDiscoveryClient,
  );
  if (owned.length === 0) return [];

  const settled = await Promise.allSettled(
    owned.map((tokenId) =>
      getPosition(tokenId.toString(), { ...options, owner, client, chainId: chain.id }),
    ),
  );
  const positions = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failed = settled.flatMap((result, index) =>
    result.status === "rejected" ? [owned[index]!] : [],
  );
  if (failed.length > 0) {
    throw new PositionDetailsReadError(failed, positions);
  }
  return positions;
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

function feeGrowthToAmount(liquidity: bigint, current: bigint, last: bigint): bigint {
  if (liquidity <= 0n || current <= last) return 0n;
  return (liquidity * (current - last)) / (1n << 128n);
}
