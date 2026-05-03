import type { Address, ChainId } from "./primitives.js";
import type { Pool } from "./pool.js";
import type { PositionSnapshot } from "./position.js";
import type { Plan, PlanCandidate, RiskNote, RiskVerdict } from "./plan.js";

export type AgentRole = "cli" | "scout" | "strategist" | "critic" | "arbiter";

export interface AxlEnvelope<T = unknown> {
  requestId: string;
  from: AgentRole;
  to: AgentRole;
  kind: AxlKind;
  payload: T;
  ts: number;
}

export type AxlKind =
  | "flow_start"
  | "flow_create_start"
  | "context_observed"
  | "proposal"
  | "critique"
  | "revision"
  | "deadlock"
  | "plan_ready"
  | "flow_failed"
  | "agent_thought"
  | `${string}:response`
  | `${string}:error`;

export interface FlowStart {
  positionId: string;
  owner?: Address;
  chainId?: ChainId;
  riskProfile?: RiskProfile;
}

export interface CreateStart {
  goal: CreateGoal;
  owner?: Address;
}

export interface CreateGoal {
  chain?: ChainId;
  capital?: CreateCapital;
  capital2?: CreateCapital;
  riskProfile?: RiskProfile;
  exposurePreference?: "stay-in-token" | "neutral";
  pinnedPair?: { token0Symbol: string; token1Symbol: string };
  pinnedFeeTier?: number;
}

export interface CreateCapital {
  tokenSymbol: string;
  amount: string;
}

export type RiskProfile = "conservative" | "balanced" | "aggressive";

export interface AgentThought {
  role: Exclude<AgentRole, "cli">;
  text: string;
  tag?: string;
}

export interface MarketContext {
  snapshot: PositionSnapshot;
  regime: MarketRegime;
  realizedVolBps: number;
  tickTravel24h: number;
  gasGwei: number;
  feeYield24hUsd: number;
  summary: string;
  source: string;
}

export interface CreateContext {
  goal: CreateGoal;
  surveyedPools: SurveyedPool[];
  gasGwei: number;
  summary: string;
  source: string;
}

export interface SurveyedPool {
  pool: Pool;
  realizedVolBps: number;
  tickTravel24h: number;
  feeYield24hUsd: number;
  regime: MarketRegime;
}

export type MarketRegime = "ranging" | "trending" | "volatile" | "stressed";

export interface RebalanceProposal {
  kind: "rebalance";
  context: MarketContext;
  candidates: PlanCandidate[];
  round: number;
  rationale: string;
}

export interface CreateProposal {
  kind: "create";
  context: CreateContext;
  candidates: CreateCandidate[];
  round: number;
  rationale: string;
}

export type Proposal = RebalanceProposal | CreateProposal;

export interface CreateCandidate {
  poolIndex: number;
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  amount0: string;
  amount1: string;
  prepAction?: string;
  expectedYield24hUsd: number;
  rationale: string;
}

export interface Critique {
  proposal: Proposal;
  judgments: CandidateJudgment[];
  decision: "accept" | "revise" | "veto_all";
  rationale: string;
}

export interface CandidateJudgment {
  index: number;
  verdict: "accept" | "revise" | "veto";
  reason: string;
  stressBufferHours?: number;
  suggestion?: string;
}

export interface Deadlock {
  history: Array<{ proposal: Proposal; critique: Critique }>;
  reason: string;
}

export interface PlanReady {
  plan: Plan;
  decidedBy: "critic" | "arbiter";
  transcript: AgentThought[];
}

export interface FlowFailed {
  stage: AgentRole;
  message: string;
}

export type { Plan, PlanCandidate, RiskNote, RiskVerdict, PositionSnapshot };
