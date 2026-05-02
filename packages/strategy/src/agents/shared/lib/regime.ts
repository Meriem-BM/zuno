import type { MarketRegime, PositionSnapshot } from "@zuno/core";

// Regime thresholds (shared by strategist + critic so reasoning agrees):
//   stressed  → vol > 350bps OR out-of-range with deep drift
//   volatile  → vol 220-350bps
//   trending  → vol 120-220bps AND price near boundary (>70% util)
//   ranging   → everything else
export function classifyRegime(input: {
  realizedVolBps: number;
  snapshot: PositionSnapshot;
  gasGwei: number;
}): MarketRegime {
  const { realizedVolBps, snapshot, gasGwei } = input;
  const utilization = snapshot.range.utilization;
  const outOfRange = !snapshot.range.inRange;

  if (realizedVolBps > 350) return "stressed";
  if (outOfRange && Math.abs(snapshot.range.distanceFromBoundary) > snapshot.range.priceCurrent * 0.04) {
    return "stressed";
  }
  if (realizedVolBps > 220) return "volatile";
  if (realizedVolBps > 120 && utilization > 0.7) return "trending";
  if (gasGwei > 60) return "stressed"; // gas spike lowers margin even if vol calm
  return "ranging";
}

export function regimeCaption(regime: MarketRegime): string {
  switch (regime) {
    case "ranging":
      return "calm, mean-reverting price action";
    case "trending":
      return "directional drift, price approaching boundary";
    case "volatile":
      return "elevated realized vol, wider tick swings";
    case "stressed":
      return "high vol or out-of-range; protection matters more than fee density";
  }
}
