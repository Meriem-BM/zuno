import type { Address, ChainId } from "./primitives.js";
import type { PositionSnapshot } from "./position.js";
import type { PlanCandidate, RiskNote } from "./plan.js";

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
  chainId?: ChainId;
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
