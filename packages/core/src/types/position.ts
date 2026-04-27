import type { Address } from "./primitives.js";
import type { Pool } from "./pool.js";

export interface Position {
  id: string;
  owner: Address;
  pool: Pool;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  // Token amounts currently deployed in the position
  amount0: string;
  amount1: string;
  // Unclaimed fees
  feesOwed0: string;
  feesOwed1: string;
}

export interface RangeReport {
  inRange: boolean;
  // Distance from current tick to nearest range boundary, in ticks
  distanceFromBoundary: number;
  // Same distance expressed as a percentage of the position width
  utilization: number;
  // Human-readable lower / upper / current price
  priceLower: number;
  priceUpper: number;
  priceCurrent: number;
}

export interface PositionSnapshot {
  position: Position;
  range: RangeReport;
  takenAt: number;
}
