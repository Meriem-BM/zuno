import type { PlanCandidate, PositionSnapshot } from "@zuno/core";
import { ZERO_ADDRESS } from "@zuno/chain/uniswap";

// Deterministic stress simulator: "how many hours until price walks out
// of this range at N× current volatility, assuming the same drift?"
// Linear tick-travel approximation is good enough for ordering candidates
// over a few-hour horizon; the critic only needs ranking, not precision.
export interface StressInput {
  candidate: PlanCandidate;
  snapshot: PositionSnapshot;
  // Baseline observed tick travel per 24h.
  tickTravel24h: number;
  // Vol multiplier: 1 = current, 2 = vol doubles, etc.
  multiplier: number;
}

export interface StressResult {
  // Hours until the projected price first crosses a boundary. Infinity if never.
  hoursUntilExit: number;
  ticksToNearestBoundary: number;
  startsOutOfRange: boolean;
}

export function stressCandidate({
  candidate,
  snapshot,
  tickTravel24h,
  multiplier,
}: StressInput): StressResult {
  const currentTick = snapshot.position.pool.currentTick;
  const distLow = currentTick - candidate.tickLower;
  const distHigh = candidate.tickUpper - currentTick;
  const startsOutOfRange = distLow < 0 || distHigh < 0;
  const ticksToNearestBoundary = startsOutOfRange ? 0 : Math.min(distLow, distHigh);

  if (startsOutOfRange) {
    return { hoursUntilExit: 0, ticksToNearestBoundary, startsOutOfRange };
  }

  const projectedTravelPerHour = (Math.max(tickTravel24h, 1) * Math.max(multiplier, 0.1)) / 24;
  if (projectedTravelPerHour <= 0) {
    return { hoursUntilExit: Infinity, ticksToNearestBoundary, startsOutOfRange };
  }
  const hoursUntilExit = ticksToNearestBoundary / projectedTravelPerHour;
  return { hoursUntilExit, ticksToNearestBoundary, startsOutOfRange };
}

// Buffer in hours under "normal" vol - the headline number for the CLI.
export function bufferHours(candidate: PlanCandidate, tickTravel24h: number): number {
  const { hoursUntilExit } = stressCandidate({
    candidate,
    snapshot: phantomSnapshotFor(candidate),
    tickTravel24h,
    multiplier: 1,
  });
  return hoursUntilExit;
}

// Buffer at 1×, 2×, and 3× vol. The 2× number is the one the critic
// prompts interrogate as the "stress floor".
export interface StressProfile {
  base: number;
  double: number;
  triple: number;
}

export function stressProfile(input: Omit<StressInput, "multiplier">): StressProfile {
  return {
    base: stressCandidate({ ...input, multiplier: 1 }).hoursUntilExit,
    double: stressCandidate({ ...input, multiplier: 2 }).hoursUntilExit,
    triple: stressCandidate({ ...input, multiplier: 3 }).hoursUntilExit,
  };
}

function phantomSnapshotFor(candidate: PlanCandidate): PositionSnapshot {
  const currentTick = Math.round((candidate.tickLower + candidate.tickUpper) / 2);
  return {
    takenAt: Date.now(),
    range: {
      inRange: true,
      distanceFromBoundary: Math.min(
        currentTick - candidate.tickLower,
        candidate.tickUpper - currentTick,
      ),
      utilization: 0.5,
      priceLower: candidate.priceLower,
      priceUpper: candidate.priceUpper,
      priceCurrent: (candidate.priceLower + candidate.priceUpper) / 2,
    },
    position: {
      id: "phantom",
      owner: ZERO_ADDRESS,
      tickLower: candidate.tickLower,
      tickUpper: candidate.tickUpper,
      liquidity: "0",
      amount0: "0",
      amount1: "0",
      feesOwed0: "0",
      feesOwed1: "0",
      pool: {
        address: ZERO_ADDRESS,
        chainId: 1,
        token0: { address: "0x0", symbol: "T0", decimals: 18 },
        token1: { address: "0x0", symbol: "T1", decimals: 18 },
        feeTier: 3000,
        tickSpacing: 60,
        currentTick,
        sqrtPriceX96: "0",
        liquidity: "0",
        price: 1,
      },
    },
  };
}
