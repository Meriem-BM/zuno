import type { Address, Position, PositionSnapshot, RangeReport } from "@zuno/core";
import { FIXTURE_POSITIONS, findFixturePosition } from "./fixtures.js";
import {
  distanceFromBoundary,
  inRange,
  tickToPrice,
  utilization,
} from "./tick-math.js";

/**
 * Resolve a position by id. In a real deployment this would call
 * NonfungiblePositionManager via viem; for demo / offline use we read from
 * the bundled fixtures.
 */
export async function getPosition(id: string): Promise<Position> {
  const p = findFixturePosition(id);
  if (!p) throw new Error(`unknown position: ${id}`);
  return p;
}

export async function listPositions(_owner: Address): Promise<Position[]> {
  // Real implementation: index Mint events or call balanceOf on the
  // NonfungiblePositionManager. Demo: return all fixtures.
  return FIXTURE_POSITIONS;
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
