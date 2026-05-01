import { chainConfig } from "@zuno/chain/config";
import type { Address, Position, PositionSnapshot, RangeReport } from "@zuno/core";
import { isAddress } from "viem";
import { distanceFromBoundary, inRange, tickToPrice, utilization } from "../math/tick-math.js";
import { FACTORY_ABI, NFPM_ABI, POOL_ABI, ZERO_ADDRESS } from "./lib/constants.js";
import {
  estimateAmounts,
  parseTokenId,
  publicClient,
  readToken,
  tickSpacingForFee,
} from "./lib/helpers.js";
import type { PositionReadOptions } from "./types.js";

export * from "./types.js";

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
      throw new Error(`position ${id} is not owned by the configured wallet`);
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
    client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "slot0" }),
    client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "liquidity" }),
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
