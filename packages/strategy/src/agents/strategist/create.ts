import type { CreateCandidate, CreateContext, CreateProposal, Critique, Pool } from "@zuno/core";
import { nearestUsableTick, tickToPrice, ZERO_ADDRESS } from "@zuno/chain/uniswap";
import { z } from "zod";
import { allocateForCreate, allocateForCreateTwoSided } from "../../planner/planning/inventory.js";
import { runAgent, agentsAvailable } from "../shared/llm.js";
import { MAX_CENTER_OFFSET_TICKS } from "../shared/lib/constants.js";
import { formatHours } from "../shared/lib/format.js";
import { stressProfile } from "../shared/lib/stress.js";
import { estimate24hFeeYield } from "../shared/lib/yield.js";
import type { ThoughtChannel } from "../shared/transcript.js";
import {
  STRATEGIST_CREATE_SYSTEM,
  strategistCreateInitialUserMessage,
  strategistCreateRevisionUserMessage,
} from "./prompts.js";

export interface StrategistCreateInput {
  context: CreateContext;
  channel: ThoughtChannel;
  round: number;
  priorCritique?: Critique;
  priorProposal?: CreateProposal;
}

interface CreateShape {
  poolIndex: number;
  widthMultiplier: number;
  centerOffsetTicks: number;
  exposureBias?: "neutral" | "long-token";
}

export async function runStrategistCreate({
  context,
  channel,
  round,
  priorCritique,
  priorProposal,
}: StrategistCreateInput): Promise<CreateProposal> {
  const tag = round === 0 ? "propose" : "revise";
  await channel.emit({
    role: "strategist",
    text:
      round === 0
        ? `proposing positions across ${context.surveyedPools.length} pools for goal: ${formatGoal(context.goal)}`
        : `revising create proposal in response to critic round ${round - 1}`,
    tag,
  });

  let shapes: CreateShape[];
  let rationale: string;

  if (agentsAvailable()) {
    const user =
      round === 0
        ? strategistCreateInitialUserMessage({ context })
        : strategistCreateRevisionUserMessage({
            context,
            priorCritique: priorCritique!,
            priorProposal: priorProposal!,
          });
    const { output } = await runAgent({
      system: STRATEGIST_CREATE_SYSTEM,
      user,
      schema: StrategistCreateSchema,
      schemaName: "strategist_create_proposal",
      temperature: round === 0 ? 0.5 : 0.3,
    });
    shapes = output.candidates.slice(0, 5).map((c) => ({
      poolIndex: c.poolIndex,
      widthMultiplier: c.widthMultiplier,
      centerOffsetTicks: c.centerOffsetTicks,
      exposureBias: c.exposureBias ?? "neutral",
    }));
    rationale = output.rationale;
  } else {
    shapes = deterministicCreateShapes(context, round);
    rationale = `${context.goal.riskProfile ?? "balanced"} create candidates from ${context.surveyedPools.length} pools (LLM unavailable).`;
  }

  await channel.emit({ role: "strategist", text: rationale, tag });

  const candidates = shapes.flatMap((shape) => buildCreateCandidate(context, shape) ?? []);

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    const pool = context.surveyedPools[c.poolIndex]!.pool;
    const profile = stressProfile({
      candidate: {
        kind: "hold",
        tickLower: c.tickLower,
        tickUpper: c.tickUpper,
        priceLower: c.priceLower,
        priceUpper: c.priceUpper,
        deploy0: "0",
        deploy1: "0",
        residual0: "0",
        residual1: "0",
        rationale: "synthetic",
      },
      snapshot: {
        takenAt: Date.now(),
        range: {
          inRange: true,
          distanceFromBoundary: c.tickUpper - pool.currentTick,
          utilization: 0.5,
          priceLower: c.priceLower,
          priceUpper: c.priceUpper,
          priceCurrent: pool.price,
        },
        position: {
          id: "synthetic",
          owner: ZERO_ADDRESS,
          tickLower: c.tickLower,
          tickUpper: c.tickUpper,
          liquidity: pool.liquidity,
          amount0: "0",
          amount1: "0",
          feesOwed0: "0",
          feesOwed1: "0",
          pool,
        },
      },
      tickTravel24h: context.surveyedPools[c.poolIndex]!.tickTravel24h,
    });
    await channel.emit({
      role: "strategist",
      text: `[${i}] ${pool.token0.symbol}/${pool.token1.symbol} ${(pool.feeTier / 10_000).toFixed(2)}%  [${c.priceLower.toFixed(4)}–${c.priceUpper.toFixed(4)}]  buffer ${formatHours(profile.base)}h  2× ${formatHours(profile.double)}h  yield ~$${c.expectedYield24hUsd.toFixed(2)}/d${c.prepAction ? `  · ${c.prepAction}` : ""}`,
      tag: "candidate",
    });
  }

  return { kind: "create", context, candidates, round, rationale };
}

function buildCreateCandidate(context: CreateContext, shape: CreateShape): CreateCandidate | null {
  const surveyed = context.surveyedPools[shape.poolIndex];
  if (!surveyed) return null;
  const pool = surveyed.pool;
  const baseWidth = Math.max(pool.tickSpacing * 8, pool.tickSpacing);
  const widthRaw = Math.round(baseWidth * shape.widthMultiplier);
  const targetWidth = Math.max(pool.tickSpacing * 2, nearestUsableTick(widthRaw, pool.tickSpacing));
  const center = pool.currentTick + shape.centerOffsetTicks;
  let tickLower = nearestUsableTick(center - targetWidth / 2, pool.tickSpacing);
  let tickUpper = nearestUsableTick(center + targetWidth / 2, pool.tickSpacing);

  if (shape.exposureBias === "long-token" && context.goal.capital) {
    const capitalIsToken0 = symbolMatches(pool, context.goal.capital.tokenSymbol, "token0");
    const drift = pool.tickSpacing * 4;
    if (capitalIsToken0) {
      tickLower += drift;
      tickUpper += drift;
    } else if (symbolMatches(pool, context.goal.capital.tokenSymbol, "token1")) {
      tickLower -= drift;
      tickUpper -= drift;
    }
  }

  const allocation = context.goal.capital2
    ? buildTwoSidedAllocation(pool, tickLower, tickUpper, context.goal)
    : (() => {
        const capitalToken = capitalSide(pool, context.goal.capital?.tokenSymbol);
        const capitalAmount = parseAtomic(
          context.goal.capital?.amount ?? "0",
          capitalToken === "token0" ? pool.token0.decimals : pool.token1.decimals,
        );
        return allocateForCreate({ pool, tickLower, tickUpper, capitalAmount, capitalToken });
      })();

  const expectedYield24hUsd = estimate24hFeeYield({
    candidate: {
      kind: "hold",
      tickLower,
      tickUpper,
      priceLower: 0,
      priceUpper: 0,
      deploy0: "0",
      deploy1: "0",
      residual0: "0",
      residual1: "0",
      rationale: "synthetic",
    },
    pool,
    tickTravel24h: surveyed.tickTravel24h,
  }).feeYield24hUsd;

  return {
    poolIndex: shape.poolIndex,
    tickLower,
    tickUpper,
    priceLower: tickToPrice(tickLower, pool.token0.decimals, pool.token1.decimals),
    priceUpper: tickToPrice(tickUpper, pool.token0.decimals, pool.token1.decimals),
    amount0: allocation.amount0,
    amount1: allocation.amount1,
    prepAction: allocation.prepAction,
    expectedYield24hUsd,
    rationale: rationaleForCreate(context, shape, pool),
  };
}

function rationaleForCreate(context: CreateContext, shape: CreateShape, pool: Pool): string {
  const widthLabel =
    shape.widthMultiplier > 1.2 ? "wide" : shape.widthMultiplier < 0.85 ? "tight" : "balanced";
  const exposure = shape.exposureBias === "long-token" ? ", token-biased" : "";
  return `${pool.token0.symbol}/${pool.token1.symbol} ${(pool.feeTier / 10_000).toFixed(2)}% (${widthLabel}${exposure}) for ${context.goal.riskProfile ?? "balanced"} goal.`;
}

function buildTwoSidedAllocation(
  pool: Pool,
  tickLower: number,
  tickUpper: number,
  goal: CreateContext["goal"],
): ReturnType<typeof allocateForCreateTwoSided> {
  const c1 = goal.capital;
  const c2 = goal.capital2;
  const resolve = (
    capital: { tokenSymbol: string; amount: string } | undefined,
  ): { side: "token0" | "token1"; amount: bigint } | null => {
    if (!capital?.tokenSymbol || !capital.amount) return null;
    if (symbolMatches(pool, capital.tokenSymbol, "token0")) {
      return { side: "token0", amount: parseAtomic(capital.amount, pool.token0.decimals) };
    }
    if (symbolMatches(pool, capital.tokenSymbol, "token1")) {
      return { side: "token1", amount: parseAtomic(capital.amount, pool.token1.decimals) };
    }
    return null;
  };
  const r1 = resolve(c1);
  const r2 = resolve(c2);
  let amount0Provided = 0n;
  let amount1Provided = 0n;
  for (const r of [r1, r2]) {
    if (!r) continue;
    if (r.side === "token0") amount0Provided += r.amount;
    else amount1Provided += r.amount;
  }
  return allocateForCreateTwoSided({
    pool,
    tickLower,
    tickUpper,
    amount0Provided,
    amount1Provided,
  });
}

function capitalSide(pool: Pool, capitalSymbol: string | undefined): "token0" | "token1" {
  if (!capitalSymbol) return "token0";
  if (symbolMatches(pool, capitalSymbol, "token0")) return "token0";
  if (symbolMatches(pool, capitalSymbol, "token1")) return "token1";
  return "token0";
}

function symbolMatches(pool: Pool, symbol: string, side: "token0" | "token1"): boolean {
  const s = symbol.toLowerCase();
  const target = (side === "token0" ? pool.token0.symbol : pool.token1.symbol).toLowerCase();
  if (s === target) return true;
  if ((s === "eth" && target === "weth") || (s === "weth" && target === "eth")) return true;
  return false;
}

function parseAtomic(amount: string, decimals: number): bigint {
  const cleaned = amount.trim();
  if (!cleaned || !/^\d+(?:\.\d+)?$/u.test(cleaned)) return 0n;
  const [whole = "0", frac = ""] = cleaned.split(".");
  const padded = frac.padEnd(decimals, "0").slice(0, decimals);
  try {
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
  } catch {
    return 0n;
  }
}

function deterministicCreateShapes(context: CreateContext, round: number): CreateShape[] {
  const profile = context.goal.riskProfile ?? "balanced";
  const exposureBias =
    context.goal.exposurePreference === "stay-in-token" ? "long-token" : "neutral";
  const widthByProfile: Record<NonNullable<typeof profile>, number> = {
    conservative: 1.6,
    balanced: 1.0,
    aggressive: 0.65,
  };
  const baseWidth = widthByProfile[profile];
  const widthMultiplier = round === 0 ? baseWidth : Math.min(3.0, baseWidth * 1.5);
  const pools = context.surveyedPools.slice(0, Math.min(3, context.surveyedPools.length));
  return pools.map((_, i) => ({
    poolIndex: i,
    widthMultiplier,
    centerOffsetTicks: 0,
    exposureBias,
  }));
}

function formatGoal(goal: CreateContext["goal"]): string {
  const parts: string[] = [];
  if (goal.capital) parts.push(`${goal.capital.amount} ${goal.capital.tokenSymbol.toUpperCase()}`);
  if (goal.riskProfile) parts.push(goal.riskProfile);
  if (goal.exposurePreference) parts.push(goal.exposurePreference);
  return parts.join(", ") || "open";
}

const StrategistCreateSchema = z.object({
  rationale: z
    .string()
    .min(20)
    .max(320)
    .describe("Why these pool/range candidates fit the user's goal. Quote vol/yield numbers."),
  candidates: z
    .array(
      z.object({
        poolIndex: z.number().int().min(0).describe("Index into surveyedPools (0-based)."),
        widthMultiplier: z
          .number()
          .min(0.3)
          .max(3.5)
          .describe(
            "Width as multiple of (tickSpacing × 8). 1.0 ≈ tickSpacing×8 wide; passive >1.5; aggressive <0.7.",
          ),
        centerOffsetTicks: z
          .number()
          .int()
          .min(-MAX_CENTER_OFFSET_TICKS)
          .max(MAX_CENTER_OFFSET_TICKS)
          .describe("Bias from current tick. Use small offsets unless market is trending."),
        exposureBias: z
          .enum(["neutral", "long-token"])
          .nullish()
          .describe(
            "neutral=center on current price; long-token=shift so user's capital token stays heavier.",
          ),
      }),
    )
    .min(2)
    .max(5),
});
