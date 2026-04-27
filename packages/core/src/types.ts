export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type ChainId = 1 | 8453 | 42161 | 10;

export interface Token {
  address: Address;
  symbol: string;
  decimals: number;
}

export interface Pool {
  address: Address;
  chainId: ChainId;
  token0: Token;
  token1: Token;
  feeTier: number;
  tickSpacing: number;
  currentTick: number;
  sqrtPriceX96: string;
  liquidity: string;
  /** Human-readable token1/token0 price */
  price: number;
}

export interface Position {
  id: string;
  owner: Address;
  pool: Pool;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  /** Token amounts currently deployed in the position */
  amount0: string;
  amount1: string;
  /** Unclaimed fees */
  feesOwed0: string;
  feesOwed1: string;
}

export interface RangeReport {
  inRange: boolean;
  /** Distance from current tick to nearest range boundary, in ticks */
  distanceFromBoundary: number;
  /** Same distance expressed as a percentage of the position width */
  utilization: number;
  /** Human-readable lower / upper / current price */
  priceLower: number;
  priceUpper: number;
  priceCurrent: number;
}

export interface PositionSnapshot {
  position: Position;
  range: RangeReport;
  takenAt: number;
}

export type PlanKind = "tighten" | "widen" | "shift" | "hold";

export interface PlanCandidate {
  kind: PlanKind;
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  /** Estimated allocation of the user's existing capital */
  deploy0: string;
  deploy1: string;
  /** Anything left over after deployment (often a swap residue) */
  residual0: string;
  residual1: string;
  rationale: string;
}

export type RiskVerdict = "approve" | "reject" | "approve_with_caution";

export interface RiskNote {
  verdict: RiskVerdict;
  confidence: number;
  reasons: string[];
}

export interface Plan {
  id: string;
  positionId: string;
  createdAt: number;
  snapshot: PositionSnapshot;
  recommended: PlanCandidate;
  rejected?: PlanCandidate;
  rejectReason?: string;
  risk: RiskNote;
}

export interface PlanDiff {
  planId: string;
  oldRange: { tickLower: number; tickUpper: number; priceLower: number; priceUpper: number };
  newRange: { tickLower: number; tickUpper: number; priceLower: number; priceUpper: number };
  current: { amount0: string; amount1: string };
  proposed: { amount0: string; amount1: string };
  residual: { amount0: string; amount1: string };
  riskNote: string;
}

/* ---------- AXL message envelopes ---------- */

export type AgentRole = "watcher" | "planner" | "risk" | "cli";

export interface AxlEnvelope<T = unknown> {
  requestId: string;
  from: AgentRole;
  to: AgentRole;
  kind: string;
  payload: T;
  ts: number;
}

export interface InspectRequest {
  positionId: string;
  owner?: Address;
}

export interface PlanRequest {
  snapshot: PositionSnapshot;
}

export interface RiskRequest {
  snapshot: PositionSnapshot;
  candidates: PlanCandidate[];
}

export interface RiskResponse {
  recommended: PlanCandidate;
  rejected?: PlanCandidate;
  rejectReason?: string;
  risk: RiskNote;
}
