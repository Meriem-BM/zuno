import type { PositionSnapshot } from "./position.js";

export type PlanKind = "tighten" | "widen" | "shift" | "hold";

export interface PlanCandidate {
  kind: PlanKind;
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  // Estimated allocation of the user's existing capital
  deploy0: string;
  deploy1: string;
  // Anything left over after deployment (often a swap residue)
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
