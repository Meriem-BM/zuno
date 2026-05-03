import type { PositionSnapshot } from "./position.js";

export type PlanKind = "tighten" | "widen" | "shift" | "hold";

export interface PlanCandidate {
  kind: PlanKind;
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  deploy0: string;
  deploy1: string;
  residual0: string;
  residual1: string;
  required0?: string;
  required1?: string;
  shortfall0?: string;
  shortfall1?: string;
  slippageBps?: number;
  prepAction?: string;
  rationale: string;
  expectedYield24hUsd?: number;
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
  // Discriminator. Defaults to "rebalance" for stored plans without it.
  kind?: "rebalance" | "create";
}

export interface PlanDiff {
  planId: string;
  pair?: string;
  token0?: { symbol: string; decimals: number };
  token1?: { symbol: string; decimals: number };
  oldRange: { tickLower: number; tickUpper: number; priceLower: number; priceUpper: number };
  newRange: { tickLower: number; tickUpper: number; priceLower: number; priceUpper: number };
  current: { amount0: string; amount1: string };
  proposed: { amount0: string; amount1: string };
  residual: { amount0: string; amount1: string };
  required?: { amount0: string; amount1: string };
  shortfall?: { amount0: string; amount1: string };
  prepAction?: string;
  slippageBps?: number;
  riskNote: string;
}
