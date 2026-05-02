import type { Address, ChainId } from "./primitives.js";
import type { Pool } from "./pool.js";
import type { PositionSnapshot } from "./position.js";
import type { Plan, PlanCandidate, RiskNote, RiskVerdict } from "./plan.js";

// Roles in the Zuno mesh. The CLI is the entry point; the four planning
// roles (scout, strategist, critic, arbiter) form a debate that converges
// on a single Plan.
export type AgentRole = "cli" | "scout" | "strategist" | "critic" | "arbiter";

export interface AxlEnvelope<T = unknown> {
  requestId: string;
  from: AgentRole;
  to: AgentRole;
  kind: AxlKind;
  payload: T;
  ts: number;
}

// Lifecycle kinds for a single recommendation flow:
//   cli         --flow_start-->         scout       (rebalance)
//   cli         --flow_create_start-->  scout       (create new position)
//   scout       --context_observed-->   strategist
//   strategist  --proposal-->           critic
//   critic      --critique-->           strategist  (if revise)
//   strategist  --revision-->           critic
//   critic      --plan_ready-->         cli         (on accept)
//   critic      --deadlock-->           arbiter     (after K rounds)
//   arbiter     --plan_ready-->         cli         (final pick with reasoning)
//
// `agent_thought` is a live narration channel; every agent emits one or
// more before any structural envelope so the CLI can render the debate.
// Suffix kinds (`:response`, `:error`) come from AxlClient.listen's
// auto-acker and are not part of the domain protocol.
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

// Only `capital.tokenSymbol` and `capital.amount` are load-bearing;
// missing values trigger one clarification turn before the debate fires.
// `riskProfile` falls back to ZUNO_RISK_PROFILE; `chain` falls back to
// the session chain; `exposurePreference` defaults to "neutral".
export interface CreateGoal {
  chain?: ChainId;
  capital?: CreateCapital;
  riskProfile?: RiskProfile;
  exposurePreference?: "stay-in-token" | "neutral";
  pinnedPair?: { token0Symbol: string; token1Symbol: string };
  pinnedFeeTier?: number;
}

export interface CreateCapital {
  // Symbol like "ETH" or "USDC", resolved to address by the chain registry.
  tokenSymbol: string;
  // Human-readable amount like "2.5"; converted to atomic at consume time.
  amount: string;
}

export type RiskProfile = "conservative" | "balanced" | "aggressive";

// Live narration line rendered as the debate transcript.
export interface AgentThought {
  role: Exclude<AgentRole, "cli">;
  text: string;
  // Structured tag like "tool:backtest", "decision", "plan_ready".
  tag?: string;
}

// Scout output for the rebalance flow.
export interface MarketContext {
  snapshot: PositionSnapshot;
  regime: MarketRegime;
  realizedVolBps: number;
  tickTravel24h: number;
  gasGwei: number;
  feeYield24hUsd: number;
  // Plain-English narration of why the regime is what it is.
  summary: string;
  // Provenance of each numeric for the user trail.
  source: string;
}

// Scout output for the create flow. Surveys multiple pools instead of one position.
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
  // Round 0 = initial; >0 = revisions in response to critique.
  round: number;
  rationale: string;
}

// Each candidate references a surveyed pool by index.
export interface CreateProposal {
  kind: "create";
  context: CreateContext;
  candidates: CreateCandidate[];
  round: number;
  rationale: string;
}

export type Proposal = RebalanceProposal | CreateProposal;

export interface CreateCandidate {
  // Index into CreateContext.surveyedPools.
  poolIndex: number;
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  // Atomic units to deposit on each side.
  amount0: string;
  amount1: string;
  // Optional prep step before mint (e.g. "swap 0.4 ETH → USDC first").
  prepAction?: string;
  expectedYield24hUsd: number;
  rationale: string;
}

export interface Critique {
  proposal: Proposal;
  // Length matches proposal.candidates.length.
  judgments: CandidateJudgment[];
  // At least one accept → strategist may converge; all veto/revise → loop.
  decision: "accept" | "revise" | "veto_all";
  rationale: string;
}

export interface CandidateJudgment {
  index: number;
  verdict: "accept" | "revise" | "veto";
  reason: string;
  // Stress-test: width sustained under 2× current vol, in hours.
  stressBufferHours?: number;
  // Concrete change the strategist should attempt if verdict is revise.
  suggestion?: string;
}

// Sent by Critic to Arbiter when no candidate accepted after K rounds.
export interface Deadlock {
  history: Array<{ proposal: Proposal; critique: Critique }>;
  reason: string;
}

// Arbiter output, or convergence output from Critic. Either way → cli.
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
