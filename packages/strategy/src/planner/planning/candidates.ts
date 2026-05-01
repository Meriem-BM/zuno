import { nearestUsableTick, tickToPrice } from "@zuno/chain/uniswap";
import type { PlanCandidate, PositionSnapshot } from "@zuno/core";
import { allocateInventory } from "./inventory.js";

export const DEFAULT_SLIPPAGE_BPS = 50;

export function proposeCandidates(snapshot: PositionSnapshot): PlanCandidate[] {
  const { position, range } = snapshot;
  const { pool } = position;
  const width = position.tickUpper - position.tickLower;
  const spacing = pool.tickSpacing;
  const currentTick = pool.currentTick;

  const wideWidth = Math.max(spacing * 2, nearestUsableTick(Math.round(width * 1.4), spacing));
  const tightWidth = Math.max(spacing * 2, nearestUsableTick(Math.round(width * 0.65), spacing));

  return [
    candidate(
      range.inRange ? "widen" : "shift",
      currentTick,
      wideWidth,
      snapshot,
      "Recenter on current tick with a wider range to restore buffer before fee density.",
    ),
    candidate(
      "tighten",
      currentTick,
      tightWidth,
      snapshot,
      "Tighter band around current tick. Higher fee density, but weaker protection if volatility persists.",
    ),
  ];
}

function candidate(
  kind: PlanCandidate["kind"],
  currentTick: number,
  width: number,
  snapshot: PositionSnapshot,
  rationale: string,
): PlanCandidate {
  const { position } = snapshot;
  const lower = nearestUsableTick(currentTick - width / 2, position.pool.tickSpacing);
  const upper = nearestUsableTick(currentTick + width / 2, position.pool.tickSpacing);
  const allocation = allocateInventory(snapshot, lower, upper);
  return {
    kind,
    tickLower: lower,
    tickUpper: upper,
    priceLower: tickToPrice(lower, position.pool.token0.decimals, position.pool.token1.decimals),
    priceUpper: tickToPrice(upper, position.pool.token0.decimals, position.pool.token1.decimals),
    deploy0: allocation.deploy0,
    deploy1: allocation.deploy1,
    residual0: allocation.residual0,
    residual1: allocation.residual1,
    required0: allocation.required0,
    required1: allocation.required1,
    shortfall0: allocation.shortfall0,
    shortfall1: allocation.shortfall1,
    slippageBps: DEFAULT_SLIPPAGE_BPS,
    prepAction: allocation.prepAction,
    rationale: allocation.prepAction ? `${rationale} ${allocation.prepAction}` : rationale,
  };
}
