import type {
  AgentThought,
  Critique,
  Plan,
  PlanReady,
  RebalanceProposal,
  RiskNote,
  RiskProfile,
} from "@zuno/core";
import { newPlanId } from "@zuno/core";
import { z } from "zod";
import { runAgent, agentsAvailable } from "../shared/llm.js";
import { formatHours } from "../shared/lib/format.js";
import type { ThoughtChannel } from "../shared/transcript.js";
import { ARBITER_SYSTEM, arbiterUserMessage } from "./prompts.js";

// Fires only on deadlock. Reads the full transcript and picks one
// candidate from the latest proposal. Risk profile is the tiebreak axis:
// conservative prefers largest 2× vol buffer; aggressive prefers highest
// non-vetoed yield even with a tighter buffer.
export interface ArbiterInput {
  history: Array<{ proposal: RebalanceProposal; critique: Critique }>;
  channel: ThoughtChannel;
  riskProfile: RiskProfile;
  transcript: AgentThought[];
}

export interface ArbiterDecision {
  plan: Plan;
  ready: PlanReady;
}

export async function runArbiter({
  history,
  channel,
  riskProfile,
  transcript,
}: ArbiterInput): Promise<ArbiterDecision> {
  await channel.emit({
    role: "arbiter",
    text: `breaking deadlock after ${history.length} rounds (${riskProfile} profile)`,
    tag: "deadlock",
  });

  const latest = history[history.length - 1]!;
  const candidates = latest.proposal.candidates;
  const lastCritique = latest.critique;

  let chosenIndex: number;
  let rationale: string;
  let verdict: RiskNote["verdict"];
  let confidence: number;

  if (agentsAvailable()) {
    const { output } = await runAgent({
      system: ARBITER_SYSTEM,
      user: arbiterUserMessage({ history, riskProfile }),
      schema: ArbiterSchema,
      schemaName: "arbiter_decision",
      temperature: 0.0,
    });
    chosenIndex = output.chosenIndex;
    rationale = output.rationale;
    verdict = output.verdict;
    confidence = output.confidence;
  } else {
    const fallback = deterministicArbiter(latest, riskProfile);
    chosenIndex = fallback.chosenIndex;
    rationale = fallback.rationale;
    verdict = fallback.verdict;
    confidence = fallback.confidence;
  }

  if (chosenIndex < 0 || chosenIndex >= candidates.length) {
    chosenIndex = 0;
    rationale = `arbiter index out of range; defaulted to candidate 0. ${rationale}`;
  }
  const recommended = candidates[chosenIndex]!;
  const rejected = candidates.find((_, i) => i !== chosenIndex);
  const losingJudgment = lastCritique.judgments.find((j) => j.index !== chosenIndex);

  await channel.emit({
    role: "arbiter",
    text: `picked candidate [${chosenIndex}] ${recommended.kind}: ${rationale}`,
    tag: "decision",
  });

  const plan: Plan = {
    id: newPlanId(),
    positionId: latest.proposal.context.snapshot.position.id,
    createdAt: Date.now(),
    snapshot: latest.proposal.context.snapshot,
    recommended,
    rejected,
    rejectReason: losingJudgment?.reason,
    risk: {
      verdict,
      confidence,
      reasons: buildReasons(history, riskProfile, rationale),
    },
  };

  return {
    plan,
    ready: { plan, decidedBy: "arbiter", transcript },
  };
}

function deterministicArbiter(
  latest: { proposal: RebalanceProposal; critique: Critique },
  riskProfile: RiskProfile,
): { chosenIndex: number; rationale: string; verdict: RiskNote["verdict"]; confidence: number } {
  const judgments = latest.critique.judgments;

  // Score: base 0; +3 for accept, +1 for revise, -10 for veto. Tiebreak by stress buffer.
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
    winner.score >= 3 && winner.buffer >= 36
      ? 0.85
      : winner.score >= 1
        ? 0.65
        : 0.45;

  return {
    chosenIndex: winner.index,
    rationale: `deterministic tiebreak: candidate [${winner.index}] best score (${winner.score}) and 2× buffer ${formatHours(winner.buffer)}h under ${riskProfile} profile.`,
    verdict,
    confidence,
  };
}

function buildReasons(
  history: ArbiterInput["history"],
  riskProfile: RiskProfile,
  arbiterRationale: string,
): string[] {
  const reasons = [arbiterRationale];
  const last = history[history.length - 1]!;
  reasons.push(
    `regime ${last.proposal.context.regime} · vol ${last.proposal.context.realizedVolBps}bps · gas ${last.proposal.context.gasGwei.toFixed(2)}gwei`,
  );
  if (history.length > 1) {
    reasons.push(
      `arbiter invoked after ${history.length} rounds without strategist/critic convergence under ${riskProfile} profile`,
    );
  }
  return reasons;
}

const ArbiterSchema = z.object({
  chosenIndex: z.number().int().min(0).describe("Index in the LATEST proposal's candidates."),
  verdict: z.enum(["approve", "approve_with_caution", "reject"]),
  confidence: z.number().min(0).max(1),
  rationale: z
    .string()
    .min(20)
    .max(320)
    .describe("Why this candidate, citing the debate. One paragraph."),
});
