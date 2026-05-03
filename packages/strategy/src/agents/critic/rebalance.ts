import type {
  CandidateJudgment,
  Critique,
  PlanCandidate,
  RebalanceProposal,
  RiskProfile,
} from "@zuno/core";
import { z } from "zod";
import { runAgent, agentsAvailable } from "../shared/llm.js";
import {
  BUFFER_FLOOR_HOURS,
  ETH_PRICE_USD_FALLBACK,
  GAS_YIELD_CEILING,
} from "../shared/lib/constants.js";
import { enforceCriticFloor } from "../shared/lib/critic-floor.js";
import { formatHours, formatRatio } from "../shared/lib/format.js";
import { stressProfile, type StressProfile } from "../shared/lib/stress.js";
import { estimate24hFeeYield, gasYieldRatio } from "../shared/lib/yield.js";
import { rebalanceCostUsd } from "../shared/lib/gas.js";
import type { ThoughtChannel } from "../shared/transcript.js";
import { CRITIC_SYSTEM, criticUserMessage } from "./prompts.js";

// Numbers come from deterministic helpers (stress, gas/yield); the LLM
// only owns the reasoning about whether those numbers clear the user's
// risk-profile floor. Financial logic stays deterministic.
export interface CriticInput {
  proposal: RebalanceProposal;
  channel: ThoughtChannel;
  riskProfile: RiskProfile;
}

export interface CandidateMetrics {
  candidate: PlanCandidate;
  index: number;
  stress: StressProfile;
  yieldUsd: number;
  gasYield: number;
}

export async function runCritic({
  proposal,
  channel,
  riskProfile,
}: CriticInput): Promise<Critique> {
  await channel.emit({
    role: "critic",
    text: `auditing ${proposal.candidates.length} candidates against ${riskProfile} risk profile`,
    tag: "critique",
  });

  const metrics = scoreCandidates(proposal);

  for (const m of metrics) {
    await channel.emit({
      role: "critic",
      text: `[${m.index}] base ${formatHours(m.stress.base)}h · 2× ${formatHours(m.stress.double)}h · 3× ${formatHours(m.stress.triple)}h · gas/yield ${formatRatio(m.gasYield)}x`,
      tag: "stress",
    });
  }

  let result: Critique;
  if (agentsAvailable()) {
    const { output } = await runAgent({
      system: CRITIC_SYSTEM,
      user: criticUserMessage({ context: proposal.context, proposal, metrics, riskProfile }),
      schema: CriticSchema,
      schemaName: "critic_judgment",
      temperature: 0.0,
    });
    const judgments: CandidateJudgment[] = output.judgments.map((j) => ({
      index: j.index,
      verdict: j.verdict,
      reason: j.reason,
      stressBufferHours: metrics.find((m) => m.index === j.index)?.stress.double,
      suggestion: j.suggestion ?? undefined,
    }));
    result = enforceCriticFloor(
      { proposal, judgments, decision: output.decision, rationale: output.rationale },
      metrics,
      riskProfile,
    );
  } else {
    result = deterministicCritique(proposal, metrics, riskProfile);
  }

  await channel.emit({
    role: "critic",
    text: `decision: ${result.decision} - ${result.rationale}`,
    tag: result.decision,
  });
  for (const j of result.judgments) {
    await channel.emit({
      role: "critic",
      text: `[${j.index}] ${j.verdict.toUpperCase()} - ${j.reason}${j.suggestion ? `  → ${j.suggestion}` : ""}`,
      tag: j.verdict,
    });
  }
  return result;
}

function scoreCandidates(proposal: RebalanceProposal): CandidateMetrics[] {
  const gasCostUsd = rebalanceCostUsd(proposal.context.gasGwei, ETH_PRICE_USD_FALLBACK);
  return proposal.candidates.map((candidate, index) => {
    const stress = stressProfile({
      candidate,
      snapshot: proposal.context.snapshot,
      tickTravel24h: proposal.context.tickTravel24h,
    });
    const yieldEst = estimate24hFeeYield({
      candidate,
      pool: proposal.context.snapshot.position.pool,
      tickTravel24h: proposal.context.tickTravel24h,
    });
    return {
      candidate,
      index,
      stress,
      yieldUsd: yieldEst.feeYield24hUsd,
      gasYield: gasYieldRatio(gasCostUsd, yieldEst.feeYield24hUsd),
    };
  });
}

function deterministicCritique(
  proposal: RebalanceProposal,
  metrics: CandidateMetrics[],
  riskProfile: RiskProfile,
): Critique {
  const minBuffer = BUFFER_FLOOR_HOURS[riskProfile];
  const maxGasYield = GAS_YIELD_CEILING[riskProfile];

  const judgments: CandidateJudgment[] = metrics.map((m) => {
    if (m.stress.base === 0) {
      return {
        index: m.index,
        verdict: "veto",
        reason: "candidate starts out of range - wasted gas with zero immediate fees",
        stressBufferHours: m.stress.double,
      };
    }
    if (m.stress.double < minBuffer / 2) {
      return {
        index: m.index,
        verdict: "veto",
        reason: `2× vol buffer ${formatHours(m.stress.double)}h is below half the ${minBuffer}h floor`,
        stressBufferHours: m.stress.double,
      };
    }
    if (m.stress.base < minBuffer || m.gasYield > maxGasYield) {
      const reason =
        m.stress.base < minBuffer
          ? `base buffer ${formatHours(m.stress.base)}h < ${minBuffer}h floor`
          : `gas/yield ${formatRatio(m.gasYield)}x > ${maxGasYield}x ceiling`;
      return {
        index: m.index,
        verdict: "revise",
        reason,
        suggestion:
          m.gasYield > maxGasYield ? "tighten width or wait for lower gas" : "widen width 20-40%",
        stressBufferHours: m.stress.double,
      };
    }
    return {
      index: m.index,
      verdict: "accept",
      reason: `buffer ${formatHours(m.stress.base)}h, gas/yield ${formatRatio(m.gasYield)}x, survives 2× vol`,
      stressBufferHours: m.stress.double,
    };
  });

  const accepts = judgments.filter((j) => j.verdict === "accept").length;
  const vetoes = judgments.filter((j) => j.verdict === "veto").length;
  const decision: Critique["decision"] =
    accepts > 0 ? "accept" : vetoes === judgments.length ? "veto_all" : "revise";

  return {
    proposal,
    judgments,
    decision,
    rationale:
      decision === "accept"
        ? `${accepts}/${metrics.length} candidates clear the ${riskProfile} floor.`
        : decision === "veto_all"
          ? `all candidates fail stress at ${proposal.context.realizedVolBps}bps under ${riskProfile} floor.`
          : `${accepts} accepts, ${vetoes} vetoes - request widening or wait for gas.`,
  };
}

export const CriticSchema = z.object({
  decision: z
    .enum(["accept", "revise", "veto_all"])
    .describe("Overall outcome. 'accept' means at least one candidate passed."),
  rationale: z
    .string()
    .min(20)
    .max(280)
    .describe("Why this decision. Quote stress buffer hours and gas/yield ratios."),
  judgments: z
    .array(
      z.object({
        index: z.number().int().min(0),
        verdict: z.enum(["accept", "revise", "veto"]),
        reason: z.string().min(10).max(220),
        suggestion: z
          .string()
          .max(220)
          .nullable()
          .describe("Concrete change for the strategist if verdict is 'revise', else null."),
      }),
    )
    .min(1),
});
