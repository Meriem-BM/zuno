import type {
  CandidateJudgment,
  CreateCandidate,
  CreateProposal,
  Critique,
  PlanCandidate,
  Pool,
  PositionSnapshot,
  RiskProfile,
} from "@zuno/core";
import { ZERO_ADDRESS } from "@zuno/chain/uniswap";
import { runAgent, agentsAvailable } from "../shared/llm.js";
import {
  BUFFER_FLOOR_HOURS,
  ETH_PRICE_USD_FALLBACK,
  GAS_YIELD_CEILING,
} from "../shared/lib/constants.js";
import { formatHours, formatRatio } from "../shared/lib/format.js";
import { stressProfile, type StressProfile } from "../shared/lib/stress.js";
import { gasYieldRatio } from "../shared/lib/yield.js";
import { rebalanceCostUsd } from "../shared/lib/gas.js";
import type { ThoughtChannel } from "../shared/transcript.js";
import { CRITIC_CREATE_SYSTEM, criticCreateUserMessage } from "./prompts.js";
import { CriticSchema } from "./rebalance.js";

export interface CriticCreateInput {
  proposal: CreateProposal;
  channel: ThoughtChannel;
  riskProfile: RiskProfile;
}

export interface CreateCandidateMetrics {
  candidate: CreateCandidate;
  index: number;
  stress: StressProfile;
  yieldUsd: number;
  gasYield: number;
}

export async function runCriticCreate({
  proposal,
  channel,
  riskProfile,
}: CriticCreateInput): Promise<Critique> {
  await channel.emit({
    role: "critic",
    text: `auditing ${proposal.candidates.length} create candidates against ${riskProfile} profile`,
    tag: "critique",
  });

  const metrics = scoreCreateCandidates(proposal);

  for (const m of metrics) {
    const pool = proposal.context.surveyedPools[m.candidate.poolIndex]!.pool;
    await channel.emit({
      role: "critic",
      text: `[${m.index}] ${pool.token0.symbol}/${pool.token1.symbol} ${(pool.feeTier / 10_000).toFixed(2)}%  base ${formatHours(m.stress.base)}h · 2× ${formatHours(m.stress.double)}h · 3× ${formatHours(m.stress.triple)}h · gas/yield ${formatRatio(m.gasYield)}x`,
      tag: "stress",
    });
  }

  let result: Critique;
  if (agentsAvailable()) {
    const { output } = await runAgent({
      system: CRITIC_CREATE_SYSTEM,
      user: criticCreateUserMessage({ proposal, metrics, riskProfile }),
      schema: CriticSchema,
      schemaName: "critic_create_judgment",
      temperature: 0.0,
    });
    const judgments: CandidateJudgment[] = output.judgments.map((j) => ({
      index: j.index,
      verdict: j.verdict,
      reason: j.reason,
      stressBufferHours: metrics.find((m) => m.index === j.index)?.stress.double,
      suggestion: j.suggestion,
    }));
    result = {
      proposal,
      judgments,
      decision: output.decision,
      rationale: output.rationale,
    };
  } else {
    result = deterministicCreateCritique(proposal, metrics, riskProfile);
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

function scoreCreateCandidates(proposal: CreateProposal): CreateCandidateMetrics[] {
  const gasCostUsd = rebalanceCostUsd(proposal.context.gasGwei, ETH_PRICE_USD_FALLBACK);
  return proposal.candidates.map((candidate, index) => {
    const surveyed = proposal.context.surveyedPools[candidate.poolIndex]!;
    const pool = surveyed.pool;
    const synthetic = createSyntheticSnapshot(pool, candidate);
    const stress = stressProfile({
      candidate: legacyShape(candidate),
      snapshot: synthetic,
      tickTravel24h: surveyed.tickTravel24h,
    });
    return {
      candidate,
      index,
      stress,
      yieldUsd: candidate.expectedYield24hUsd,
      gasYield: gasYieldRatio(gasCostUsd, candidate.expectedYield24hUsd),
    };
  });
}

function deterministicCreateCritique(
  proposal: CreateProposal,
  metrics: CreateCandidateMetrics[],
  riskProfile: RiskProfile,
): Critique {
  const minBuffer = BUFFER_FLOOR_HOURS[riskProfile];
  const maxGasYield = GAS_YIELD_CEILING[riskProfile];

  const judgments: CandidateJudgment[] = metrics.map((m) => {
    if (m.stress.base === 0) {
      return {
        index: m.index,
        verdict: "veto",
        reason: "candidate range starts out of current price - pool not active for that band",
        stressBufferHours: m.stress.double,
      };
    }
    if (m.stress.double < minBuffer / 2) {
      return {
        index: m.index,
        verdict: "veto",
        reason: `2× vol buffer ${formatHours(m.stress.double)}h < half the ${minBuffer}h ${riskProfile} floor`,
        stressBufferHours: m.stress.double,
      };
    }
    if (m.stress.base < minBuffer || m.gasYield > maxGasYield) {
      return {
        index: m.index,
        verdict: "revise",
        reason:
          m.stress.base < minBuffer
            ? `base buffer ${formatHours(m.stress.base)}h < ${minBuffer}h floor`
            : `gas/yield ${formatRatio(m.gasYield)}x > ${maxGasYield}x ceiling`,
        suggestion: m.gasYield > maxGasYield ? "tighten width or wait for lower gas" : "widen 30-60%",
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
        ? `${accepts}/${metrics.length} create candidates clear the ${riskProfile} floor.`
        : decision === "veto_all"
          ? `every create candidate fails stress under ${riskProfile} floor - widen ranges or pick a calmer pool.`
          : `${accepts} accepts, ${vetoes} vetoes - revise width or pool choice.`,
  };
}

function createSyntheticSnapshot(pool: Pool, candidate: CreateCandidate): PositionSnapshot {
  return {
    takenAt: Date.now(),
    range: {
      inRange:
        pool.currentTick >= candidate.tickLower && pool.currentTick <= candidate.tickUpper,
      distanceFromBoundary: Math.min(
        pool.currentTick - candidate.tickLower,
        candidate.tickUpper - pool.currentTick,
      ),
      utilization: 0.5,
      priceLower: candidate.priceLower,
      priceUpper: candidate.priceUpper,
      priceCurrent: pool.price,
    },
    position: {
      id: "create-synthetic",
      owner: ZERO_ADDRESS,
      tickLower: candidate.tickLower,
      tickUpper: candidate.tickUpper,
      liquidity: pool.liquidity,
      amount0: candidate.amount0,
      amount1: candidate.amount1,
      feesOwed0: "0",
      feesOwed1: "0",
      pool,
    },
  };
}

function legacyShape(c: CreateCandidate): PlanCandidate {
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
    rationale: c.rationale,
  };
}
