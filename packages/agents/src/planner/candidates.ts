import type { PlanCandidate, PositionSnapshot } from "@zuno/core";
import { nearestUsableTick, tickToPrice } from "@zuno/uniswap";

const half = (a: string): string => (BigInt(a || "0") / 2n).toString();
const tenth = (a: string): string => (BigInt(a || "0") / 10n).toString();

/**
 * Two deterministic candidates per snapshot: a recenter+widen and a tighten.
 * Numbers come from tick math only — the model never invents values, it only
 * synthesises explanations on top.
 */
export function proposeCandidates(s: PositionSnapshot): PlanCandidate[] {
  const { position, range } = s;
  const { pool } = position;
  const spacing = pool.tickSpacing;
  const dec0 = pool.token0.decimals;
  const dec1 = pool.token1.decimals;
  const tick = pool.currentTick;
  const width = position.tickUpper - position.tickLower;

  const widenWidth = nearestUsableTick(Math.round(width * 1.4), spacing);
  const tightWidth = nearestUsableTick(Math.round(width * 0.65), spacing);

  const wideLower = nearestUsableTick(tick - widenWidth / 2, spacing);
  const wideUpper = nearestUsableTick(tick + widenWidth / 2, spacing);
  const tightLower = nearestUsableTick(tick - tightWidth / 2, spacing);
  const tightUpper = nearestUsableTick(tick + tightWidth / 2, spacing);

  const wide: PlanCandidate = {
    kind: range.inRange ? "widen" : "shift",
    tickLower: wideLower,
    tickUpper: wideUpper,
    priceLower: tickToPrice(wideLower, dec0, dec1),
    priceUpper: tickToPrice(wideUpper, dec0, dec1),
    deploy0: half(position.amount0),
    deploy1: half(position.amount1),
    residual0: tenth(position.amount0),
    residual1: tenth(position.amount1),
    rationale:
      "Recenter on current tick with ~40% wider range. Sacrifices fee density for a longer in-range buffer.",
  };

  const tight: PlanCandidate = {
    kind: "tighten",
    tickLower: tightLower,
    tickUpper: tightUpper,
    priceLower: tickToPrice(tightLower, dec0, dec1),
    priceUpper: tickToPrice(tightUpper, dec0, dec1),
    deploy0: half(position.amount0),
    deploy1: half(position.amount1),
    residual0: tenth(position.amount0),
    residual1: tenth(position.amount1),
    rationale:
      "Tighter band on current tick. Higher fee density but vulnerable to short-horizon volatility.",
  };

  return [wide, tight];
}
