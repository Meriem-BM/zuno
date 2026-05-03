import type {
  AgentRole,
  AgentThought,
  ChainId,
  CreateCandidate,
  CreateProposal,
  CreateStart,
  Critique,
  FlowStart,
  Plan,
  PlanCandidate,
  PlanReady,
  Pool,
  PositionSnapshot,
  RebalanceProposal,
  RiskNote,
  RiskProfile,
} from "@zuno/core";
import { newPlanId } from "@zuno/core";
import { ZERO_ADDRESS } from "@zuno/chain/uniswap";
import { runScout, runScoutCreate } from "./scout/handler.js";
import { runStrategist, runStrategistCreate } from "./strategist/handler.js";
import { runCritic, runCriticCreate } from "./critic/handler.js";
import { runArbiter, runArbiterCreate } from "./arbiter/handler.js";
import { BUFFER_FLOOR_HOURS } from "./shared/lib/constants.js";
import type { ThoughtChannel, ThoughtSink } from "./shared/transcript.js";

function hasValidAccept(critique: Critique, candidateCount: number): boolean {
  return critique.judgments.some(
    (j) => j.verdict === "accept" && j.index >= 0 && j.index < candidateCount,
  );
}

function criticAcceptedSummary(buffer: number, riskProfile: RiskProfile): string {
  const floor = BUFFER_FLOOR_HOURS[riskProfile];
  const buf = buffer.toFixed(0);
  return buffer >= floor
    ? `Cleared the ${riskProfile} stress floor with a ${buf}h volatility buffer (Critic accepted).`
    : `Accepted under ${riskProfile} profile with a ${buf}h volatility buffer (below the ${floor}h ideal — Critic accepted).`;
}

export interface OrchestratorOptions {
  start: FlowStart;
  onThought?: ThoughtSink;
  maxRounds?: number;
}

export interface OrchestratorResult {
  plan: Plan;
  ready: PlanReady;
}

export async function runDebate({
  start,
  onThought,
  maxRounds = 2,
}: OrchestratorOptions): Promise<OrchestratorResult> {
  const riskProfile = start.riskProfile ?? "balanced";
  const transcript: AgentThought[] = [];
  const accumulator: ThoughtSink = async (thought) => {
    transcript.push(thought);
    if (onThought) await onThought(thought);
  };

  const context = await runScout({
    start,
    channel: roleChannel("scout", accumulator),
  });

  const history: Array<{ proposal: RebalanceProposal; critique: Critique }> = [];

  for (let round = 0; round < maxRounds; round++) {
    const proposal = await runStrategist({
      context,
      channel: roleChannel("strategist", accumulator),
      round,
      priorCritique: round === 0 ? undefined : history[round - 1]!.critique,
      priorProposal: round === 0 ? undefined : history[round - 1]!.proposal,
    });

    const critique = await runCritic({
      proposal,
      channel: roleChannel("critic", accumulator),
      riskProfile,
    });
    history.push({ proposal, critique });

    if (critique.decision === "accept" && hasValidAccept(critique, proposal.candidates.length)) {
      return convergedResult({ context, proposal, critique, transcript, riskProfile });
    }
  }

  const arbiterChannel = roleChannel("arbiter", accumulator);
  const decision = await runArbiter({
    history,
    channel: arbiterChannel,
    riskProfile,
    transcript: [...transcript],
  });
  return {
    plan: decision.plan,
    ready: { ...decision.ready, transcript: [...transcript] },
  };
}

interface ConvergeInput {
  context: RebalanceProposal["context"];
  proposal: RebalanceProposal;
  critique: Critique;
  transcript: AgentThought[];
  riskProfile: RiskProfile;
}

function convergedResult({
  context,
  proposal,
  critique,
  transcript,
  riskProfile,
}: ConvergeInput): OrchestratorResult {
  const accepted = critique.judgments.find((j) => j.verdict === "accept")!;
  const recommended = proposal.candidates[accepted.index]!;
  const rejected = proposal.candidates.find((_, i) => i !== accepted.index);
  const losingJudgment = critique.judgments.find((j) => j.index !== accepted.index);
  const buffer = accepted.stressBufferHours ?? 0;
  const verdict: RiskNote["verdict"] = buffer >= 36 ? "approve" : "approve_with_caution";
  const confidence = buffer >= 48 ? 0.9 : buffer >= 24 ? 0.78 : 0.62;

  const plan: Plan = {
    id: newPlanId(),
    kind: "rebalance",
    positionId: context.snapshot.position.id,
    createdAt: Date.now(),
    snapshot: context.snapshot,
    recommended,
    rejected,
    rejectReason: losingJudgment?.reason,
    risk: {
      verdict,
      confidence,
      reasons: [
        criticAcceptedSummary(buffer, riskProfile),
        accepted.reason,
        critique.rationale,
        `regime ${context.regime} · vol ${context.realizedVolBps}bps · gas ${context.gasGwei.toFixed(2)}gwei`,
      ],
    },
  };
  return { plan, ready: { plan, decidedBy: "critic", transcript: [...transcript] } };
}

function roleChannel(role: Exclude<AgentRole, "cli">, accumulator: ThoughtSink): ThoughtChannel {
  const local: AgentThought[] = [];
  return {
    async emit(thought) {
      const stamped: AgentThought = { ...thought, role: thought.role ?? role };
      local.push(stamped);
      await accumulator(stamped);
    },
    history: () => [...local],
  };
}

export interface CreateOrchestratorOptions {
  start: CreateStart;
  chainId: ChainId;
  onThought?: ThoughtSink;
  maxRounds?: number;
}

export async function runDebateCreate({
  start,
  chainId,
  onThought,
  maxRounds = 2,
}: CreateOrchestratorOptions): Promise<OrchestratorResult> {
  const riskProfile = start.goal.riskProfile ?? "balanced";
  const transcript: AgentThought[] = [];
  const accumulator: ThoughtSink = async (thought) => {
    transcript.push(thought);
    if (onThought) await onThought(thought);
  };

  const context = await runScoutCreate({
    start,
    chainId,
    channel: roleChannel("scout", accumulator),
  });

  const history: Array<{ proposal: CreateProposal; critique: Critique }> = [];

  for (let round = 0; round < maxRounds; round++) {
    const proposal = await runStrategistCreate({
      context,
      channel: roleChannel("strategist", accumulator),
      round,
      priorCritique: round === 0 ? undefined : history[round - 1]!.critique,
      priorProposal: round === 0 ? undefined : history[round - 1]!.proposal,
    });
    const critique = await runCriticCreate({
      proposal,
      channel: roleChannel("critic", accumulator),
      riskProfile,
    });
    history.push({ proposal, critique });

    if (critique.decision === "accept" && hasValidAccept(critique, proposal.candidates.length)) {
      return convergedCreateResult({ proposal, critique, transcript, riskProfile });
    }
  }

  const arbiterChannel = roleChannel("arbiter", accumulator);
  const decision = await runArbiterCreate({
    history,
    channel: arbiterChannel,
    riskProfile,
    transcript: [...transcript],
  });
  return {
    plan: decision.plan,
    ready: { ...decision.ready, transcript: [...transcript] },
  };
}

function convergedCreateResult(input: {
  proposal: CreateProposal;
  critique: Critique;
  transcript: AgentThought[];
  riskProfile: RiskProfile;
}): OrchestratorResult {
  const { proposal, critique, transcript, riskProfile } = input;
  const accepted = critique.judgments.find((j) => j.verdict === "accept")!;
  const recommended = proposal.candidates[accepted.index]!;
  const losingJudgment = critique.judgments.find((j) => j.index !== accepted.index);
  const surveyed = proposal.context.surveyedPools[recommended.poolIndex]!;
  const pool = surveyed.pool;
  const buffer = accepted.stressBufferHours ?? 0;
  const verdict: RiskNote["verdict"] = buffer >= 36 ? "approve" : "approve_with_caution";
  const confidence = buffer >= 48 ? 0.9 : buffer >= 24 ? 0.78 : 0.62;

  const planCandidate: PlanCandidate = {
    kind: "hold",
    tickLower: recommended.tickLower,
    tickUpper: recommended.tickUpper,
    priceLower: recommended.priceLower,
    priceUpper: recommended.priceUpper,
    deploy0: recommended.amount0,
    deploy1: recommended.amount1,
    residual0: "0",
    residual1: "0",
    required0: recommended.amount0,
    required1: recommended.amount1,
    shortfall0: "0",
    shortfall1: "0",
    slippageBps: 50,
    prepAction: recommended.prepAction,
    rationale: recommended.rationale,
  };
  const rejectedLegacy = proposal.candidates
    .filter((_, i) => i !== accepted.index)
    .map(
      (c) =>
        ({
          kind: "hold" as const,
          tickLower: c.tickLower,
          tickUpper: c.tickUpper,
          priceLower: c.priceLower,
          priceUpper: c.priceUpper,
          deploy0: c.amount0,
          deploy1: c.amount1,
          residual0: "0",
          residual1: "0",
          rationale: c.rationale,
        }) as PlanCandidate,
    )[0];

  const plan: Plan = {
    id: newPlanId(),
    kind: "create",
    positionId: `create:${pool.token0.symbol}/${pool.token1.symbol}@${pool.feeTier}`,
    createdAt: Date.now(),
    snapshot: createSnapshot(pool, recommended),
    recommended: planCandidate,
    rejected: rejectedLegacy,
    rejectReason: losingJudgment?.reason,
    risk: {
      verdict,
      confidence,
      reasons: [
        criticAcceptedSummary(buffer, riskProfile),
        accepted.reason,
        critique.rationale,
        `regime ${surveyed.regime} · vol ${surveyed.realizedVolBps}bps · gas ${proposal.context.gasGwei.toFixed(2)}gwei`,
      ],
    },
  };
  return { plan, ready: { plan, decidedBy: "critic", transcript: [...transcript] } };
}

function createSnapshot(pool: Pool, candidate: CreateCandidate): PositionSnapshot {
  return {
    takenAt: Date.now(),
    range: {
      inRange: true,
      distanceFromBoundary: pool.tickSpacing * 4,
      utilization: 0.5,
      priceLower: candidate.priceLower,
      priceUpper: candidate.priceUpper,
      priceCurrent: pool.price,
    },
    position: {
      id: "create",
      owner: ZERO_ADDRESS,
      tickLower: candidate.tickLower,
      tickUpper: candidate.tickUpper,
      liquidity: "0",
      amount0: candidate.amount0,
      amount1: candidate.amount1,
      feesOwed0: "0",
      feesOwed1: "0",
      pool,
    },
  };
}
