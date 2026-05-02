import type {
  AgentThought,
  CreateCandidate,
  CreateProposal,
  Critique,
  Plan,
  PlanCandidate,
  PlanReady,
  PositionSnapshot,
  RiskNote,
  RiskProfile,
} from "@zuno/core";
import { newPlanId } from "@zuno/core";
import { ZERO_ADDRESS } from "@zuno/chain/uniswap";
import type { ThoughtChannel } from "../shared/transcript.js";

export interface ArbiterCreateInput {
  history: Array<{ proposal: CreateProposal; critique: Critique }>;
  channel: ThoughtChannel;
  riskProfile: RiskProfile;
  transcript: AgentThought[];
}

export interface ArbiterCreateDecision {
  plan: Plan;
  ready: PlanReady;
}

export async function runArbiterCreate({
  history,
  channel,
  riskProfile,
  transcript,
}: ArbiterCreateInput): Promise<ArbiterCreateDecision> {
  await channel.emit({
    role: "arbiter",
    text: `breaking deadlock on create flow after ${history.length} rounds (${riskProfile})`,
    tag: "deadlock",
  });

  const latest = history[history.length - 1]!;
  const candidates = latest.proposal.candidates;
  const lastCritique = latest.critique;

  const fallback = deterministicCreateArbiter(latest, riskProfile);
  const chosenIndex =
    fallback.chosenIndex >= 0 && fallback.chosenIndex < candidates.length
      ? fallback.chosenIndex
      : 0;
  const recommended = candidates[chosenIndex]!;
  const losingJudgment = lastCritique.judgments.find((j) => j.index !== chosenIndex);

  await channel.emit({
    role: "arbiter",
    text: `picked candidate [${chosenIndex}] (poolIndex=${recommended.poolIndex}): ${fallback.rationale}`,
    tag: "decision",
  });

  // We don't yet ship a position id (the chain assigns it on mint). The
  // PlanReady carries the recommended CreateCandidate via the snapshot
  // shim below + plan.kind="create" so applyPlan dispatches correctly.
  const surveyed = latest.proposal.context.surveyedPools[recommended.poolIndex]!;
  const pool = surveyed.pool;
  const planCandidate = createCandidateAsLegacy(recommended);
  const rejectedLegacy = candidates
    .map((c, i) => (i === chosenIndex ? null : createCandidateAsLegacy(c)))
    .find((c): c is PlanCandidate => Boolean(c));

  const plan: Plan = {
    id: newPlanId(),
    kind: "create",
    positionId: `create:${pool.token0.symbol}/${pool.token1.symbol}@${pool.feeTier}`,
    createdAt: Date.now(),
    snapshot: createCandidateSnapshot(latest.proposal, recommended),
    recommended: planCandidate,
    rejected: rejectedLegacy,
    rejectReason: losingJudgment?.reason,
    risk: {
      verdict: fallback.verdict,
      confidence: fallback.confidence,
      reasons: [
        fallback.rationale,
        `regime ${surveyed.regime} · vol ${surveyed.realizedVolBps}bps · gas ${latest.proposal.context.gasGwei.toFixed(2)}gwei`,
        history.length > 1
          ? `arbiter invoked after ${history.length} rounds without convergence`
          : "arbiter invoked",
      ],
    },
  };

  return { plan, ready: { plan, decidedBy: "arbiter", transcript } };
}

function deterministicCreateArbiter(
  latest: { proposal: CreateProposal; critique: Critique },
  riskProfile: RiskProfile,
): { chosenIndex: number; rationale: string; verdict: RiskNote["verdict"]; confidence: number } {
  const judgments = latest.critique.judgments;
  const scored = judgments.map((j) => {
    const base = j.verdict === "accept" ? 3 : j.verdict === "revise" ? 1 : -10;
    const buffer = j.stressBufferHours ?? 0;
    return { index: j.index, score: base, buffer };
  });
  scored.sort((a, b) => b.score - a.score || b.buffer - a.buffer);
  const winner = scored[0]!;
  const verdict: RiskNote["verdict"] =
    winner.score >= 3 ? "approve" : winner.score < 0 ? "reject" : "approve_with_caution";
  const confidence =
    winner.score >= 3 && winner.buffer >= 36 ? 0.85 : winner.score >= 1 ? 0.65 : 0.45;
  return {
    chosenIndex: winner.index,
    rationale: `deterministic tiebreak: candidate [${winner.index}] best score (${winner.score}) and 2× buffer ${winner.buffer.toFixed(0)}h under ${riskProfile} profile.`,
    verdict,
    confidence,
  };
}

function createCandidateAsLegacy(c: CreateCandidate): PlanCandidate {
  return {
    kind: "hold",
    tickLower: c.tickLower,
    tickUpper: c.tickUpper,
    priceLower: c.priceLower,
    priceUpper: c.priceUpper,
    deploy0: c.amount0,
    deploy1: c.amount1,
    residual0: "0",
    residual1: "0",
    required0: c.amount0,
    required1: c.amount1,
    shortfall0: "0",
    shortfall1: "0",
    slippageBps: 50,
    prepAction: c.prepAction,
    rationale: c.rationale,
  };
}

function createCandidateSnapshot(
  proposal: CreateProposal,
  candidate: CreateCandidate,
): PositionSnapshot {
  const pool = proposal.context.surveyedPools[candidate.poolIndex]!.pool;
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
