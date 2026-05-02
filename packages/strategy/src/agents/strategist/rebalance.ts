import type {
  Critique,
  MarketContext,
  PlanCandidate,
  RebalanceProposal,
} from "@zuno/core";
import { nearestUsableTick, tickToPrice } from "@zuno/chain/uniswap";
import { z } from "zod";
import { allocateInventory } from "../../planner/planning/inventory.js";
import { runAgent, agentsAvailable } from "../shared/llm.js";
import { MAX_CENTER_OFFSET_TICKS } from "../shared/lib/constants.js";
import { formatHours } from "../shared/lib/format.js";
import { stressProfile } from "../shared/lib/stress.js";
import { estimate24hFeeYield } from "../shared/lib/yield.js";
import type { ThoughtChannel } from "../shared/transcript.js";
import {
  STRATEGIST_SYSTEM,
  strategistInitialUserMessage,
  strategistRevisionUserMessage,
} from "./prompts.js";

// Determinism floor: the LLM picks (centerOffset, widthMultiplier) pairs
// only - we snap to tickSpacing and run real inventory allocation +
// stress on the result. The LLM never fabricates tick numbers.
export interface StrategistInput {
  context: MarketContext;
  channel: ThoughtChannel;
  // Round 0 = initial; >0 = revision in response to critique.
  round: number;
  // Required when round > 0. Drives which complaints to address.
  priorCritique?: Critique;
  // Optional - for the LLM to compare to its own ideas.
  priorProposal?: RebalanceProposal;
}

export async function runStrategist({
  context,
  channel,
  round,
  priorCritique,
  priorProposal,
}: StrategistInput): Promise<RebalanceProposal> {
  const tag = round === 0 ? "propose" : "revise";
  await channel.emit({
    role: "strategist",
    text:
      round === 0
        ? `regime is ${context.regime}; drafting candidate ranges`
        : `revising in response to critic round ${round - 1}`,
    tag,
  });

  let shapes: CandidateShape[];
  let rationale: string;

  if (agentsAvailable()) {
    const user =
      round === 0
        ? strategistInitialUserMessage({ context })
        : strategistRevisionUserMessage({ context, priorCritique: priorCritique!, priorProposal: priorProposal! });
    const { output } = await runAgent({
      system: STRATEGIST_SYSTEM,
      user,
      schema: StrategistSchema,
      schemaName: "strategist_proposal",
      temperature: round === 0 ? 0.5 : 0.3,
    });
    shapes = output.candidates.slice(0, 5);
    rationale = output.rationale;
    await channel.emit({ role: "strategist", text: output.rationale, tag });
  } else {
    // Deterministic fallback - ratios mimic the legacy 1.4×/0.65× plus a couple of variants.
    shapes =
      round === 0
        ? [
          { kind: "widen", widthMultiplier: 1.4, centerOffsetTicks: 0 },
          { kind: "tighten", widthMultiplier: 0.65, centerOffsetTicks: 0 },
          { kind: "shift", widthMultiplier: 1.0, centerOffsetTicks: 0 },
        ]
        : [
          { kind: "widen", widthMultiplier: 1.6, centerOffsetTicks: 0 },
          { kind: "shift", widthMultiplier: 1.2, centerOffsetTicks: 0 },
        ];
    rationale = `${context.regime}: deterministic candidate set (LLM unavailable).`;
    await channel.emit({ role: "strategist", text: rationale, tag });
  }

  const candidates = shapes.map((shape) => buildCandidate(context, shape));

  // Narrate stress + yield per candidate so the CLI transcript reads like a debate.
  for (const c of candidates) {
    const profile = stressProfile({
      candidate: c,
      snapshot: context.snapshot,
      tickTravel24h: context.tickTravel24h,
    });
    const yieldEst = estimate24hFeeYield({
      candidate: c,
      pool: context.snapshot.position.pool,
      tickTravel24h: context.tickTravel24h,
    });
    await channel.emit({
      role: "strategist",
      text: `${c.kind} [${c.priceLower.toFixed(4)}–${c.priceUpper.toFixed(4)}]  buffer ${formatHours(profile.base)}h  2× ${formatHours(profile.double)}h  yield ~$${yieldEst.feeYield24hUsd.toFixed(2)}/d`,
      tag: "candidate",
    });
  }

  return { kind: "rebalance", context, candidates, round, rationale };
}

interface CandidateShape {
  kind: PlanCandidate["kind"];
  widthMultiplier: number;
  centerOffsetTicks: number;
}

function buildCandidate(context: MarketContext, shape: CandidateShape): PlanCandidate {
  const { snapshot } = context;
  const pool = snapshot.position.pool;
  const currentWidth = snapshot.position.tickUpper - snapshot.position.tickLower;
  const baseWidth = Math.max(pool.tickSpacing * 4, currentWidth);
  const targetWidth = Math.max(
    pool.tickSpacing * 2,
    nearestUsableTick(Math.round(baseWidth * shape.widthMultiplier), pool.tickSpacing),
  );
  const center = pool.currentTick + shape.centerOffsetTicks;
  const tickLower = nearestUsableTick(center - targetWidth / 2, pool.tickSpacing);
  const tickUpper = nearestUsableTick(center + targetWidth / 2, pool.tickSpacing);
  const allocation = allocateInventory(snapshot, tickLower, tickUpper);

  return {
    kind: shape.kind,
    tickLower,
    tickUpper,
    priceLower: tickToPrice(tickLower, pool.token0.decimals, pool.token1.decimals),
    priceUpper: tickToPrice(tickUpper, pool.token0.decimals, pool.token1.decimals),
    deploy0: allocation.deploy0,
    deploy1: allocation.deploy1,
    residual0: allocation.residual0,
    residual1: allocation.residual1,
    required0: allocation.required0,
    required1: allocation.required1,
    shortfall0: allocation.shortfall0,
    shortfall1: allocation.shortfall1,
    slippageBps: 50,
    prepAction: allocation.prepAction,
    rationale: rationaleFor(context, shape),
  };
}

function rationaleFor(context: MarketContext, shape: CandidateShape): string {
  const widthLabel =
    shape.widthMultiplier > 1.2 ? "wider" : shape.widthMultiplier < 0.85 ? "tighter" : "centered";
  return `${shape.kind} (${widthLabel}, ${shape.widthMultiplier.toFixed(2)}× current width) given ${context.regime} regime.`;
}

const StrategistSchema = z.object({
  rationale: z
    .string()
    .min(20)
    .max(280)
    .describe("Why this set of candidates fits the regime. Quote vol/gas/yield numbers."),
  candidates: z
    .array(
      z.object({
        kind: z.enum(["tighten", "widen", "shift", "hold"]),
        widthMultiplier: z
          .number()
          .min(0.3)
          .max(3.5)
          .describe("Width relative to the current position width. 1.0 = same, 1.4 = 40% wider."),
        centerOffsetTicks: z
          .number()
          .int()
          .min(-MAX_CENTER_OFFSET_TICKS)
          .max(MAX_CENTER_OFFSET_TICKS)
          .describe(
            "Center offset from current tick, in ticks. 0 = center on current price. Use small offsets only.",
          ),
      }),
    )
    .min(2)
    .max(5),
});
