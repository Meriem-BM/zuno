import type { PlanCandidate, Pool } from "@zuno/core";

// First-order yield estimate, not a backtest. Drives strategist's choice
// between wide vs tight candidates without faking numbers from a hash.
//   fee_yield ≈ fee_tier × pool_liquidity × in_range_share
// where in_range_share is the fraction of expected daily tick travel that
// sits inside the candidate's width.
export interface YieldInput {
  candidate: PlanCandidate;
  pool: Pool;
  // Estimated tick travel per 24h, from volatility module.
  tickTravel24h: number;
  // Optional reference price for token1. Defaults to 1 (e.g. stable).
  token1UsdPrice?: number;
}

export interface YieldEstimate {
  feeYield24hUsd: number;
  inRangeShare: number;
  source: string;
}

export function estimate24hFeeYield({
  candidate,
  pool,
  tickTravel24h,
  token1UsdPrice = 1,
}: YieldInput): YieldEstimate {
  const width = candidate.tickUpper - candidate.tickLower;
  const inRangeShare = width <= 0 ? 0 : Math.min(1, width / Math.max(tickTravel24h * 2, 1));

  // Pool liquidity is a 128-bit string; use the high bits to scale.
  const liquidityScale =
    pool.liquidity.length > 18
      ? Number(pool.liquidity.slice(0, pool.liquidity.length - 12))
      : Number(pool.liquidity || "0") / 1e6;
  const dailyFeeUnits = (liquidityScale * pool.feeTier) / 10_000 / 365;
  const feeYield24hUsd = Math.max(0, dailyFeeUnits * inRangeShare * token1UsdPrice);

  return {
    feeYield24hUsd,
    inRangeShare,
    source: "estimate:liquidity*fee_tier*in_range_share",
  };
}

// Anything above ~1.5x gives the critic grounds to push back: candidate
// won't earn back its rebalance gas in a day.
export function gasYieldRatio(gasCostUsd: number, feeYield24hUsd: number): number {
  if (feeYield24hUsd <= 0) return Infinity;
  return gasCostUsd / feeYield24hUsd;
}
