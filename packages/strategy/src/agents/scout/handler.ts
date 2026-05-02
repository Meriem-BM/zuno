import type {
  AgentThought,
  ChainId,
  CreateContext,
  CreateStart,
  FlowStart,
  MarketContext,
  Pool,
  PositionSnapshot,
  SurveyedPool,
} from "@zuno/core";
import { buildSnapshot, getPosition, ZERO_ADDRESS } from "@zuno/chain/uniswap";
import { z } from "zod";
import { defaultRiskContext } from "../../planner/index.js";
import { loadRiskContext } from "../../planner/risk/oracle.js";
import { discoverPools } from "../shared/lib/pools.js";
import { runAgent, agentsAvailable } from "../shared/llm.js";
import { readGasGwei } from "../shared/lib/gas.js";
import { estimate24hFeeYield } from "../shared/lib/yield.js";
import { classifyRegime, regimeCaption } from "../shared/lib/regime.js";
import type { ThoughtChannel } from "../shared/transcript.js";
import {
  SCOUT_CREATE_SYSTEM,
  SCOUT_SYSTEM,
  scoutCreateUserMessage,
  scoutUserMessage,
} from "./prompts.js";

export interface ScoutInput {
  start: FlowStart;
  channel: ThoughtChannel;
}

export async function runScout({ start, channel }: ScoutInput): Promise<MarketContext> {
  await channel.emit({ role: "scout", text: `reading position ${start.positionId} from chain`, tag: "tool:chain_read" });

  const position = await getPosition(start.positionId, {
    owner: start.owner,
    chainId: start.chainId,
  });
  const snapshot = buildSnapshot(position);

  await channel.emit({
    role: "scout",
    text: `position ${snapshot.range.inRange ? "in range" : "OUT OF RANGE"} · tick=${position.pool.currentTick} · range=[${position.tickLower}..${position.tickUpper}]`,
    tag: "snapshot",
  });

  const riskCtx = await loadRiskContext(snapshot).catch(() => defaultRiskContext(snapshot));
  const gas = await readGasGwei(snapshot.position.pool.chainId as ChainId);
  await channel.emit({
    role: "scout",
    text: `vol=${riskCtx.realizedVolBps}bps · gas=${gas.gwei.toFixed(2)}gwei (${gas.source}) · vol_source=${riskCtx.source}`,
    tag: "tool:market_data",
  });

  const yieldEstimate = estimate24hFeeYield({
    candidate: phantomCandidateForCurrent(snapshot),
    pool: snapshot.position.pool,
    tickTravel24h: riskCtx.tickTravel24h,
  });

  const regime = classifyRegime({
    realizedVolBps: riskCtx.realizedVolBps,
    snapshot,
    gasGwei: gas.gwei,
  });

  let summary: string;
  if (agentsAvailable()) {
    const { output } = await runAgent({
      system: SCOUT_SYSTEM,
      user: scoutUserMessage({ snapshot, riskCtx, gas, regime }),
      schema: ScoutSchema,
      schemaName: "scout_assessment",
      temperature: 0.3,
    });
    summary = output.summary;
    await channel.emit({ role: "scout", text: output.summary, tag: "regime" });
  } else {
    summary = `${regime}: ${regimeCaption(regime)} (deterministic fallback)`;
    await channel.emit({ role: "scout", text: summary, tag: "regime" });
  }

  return {
    snapshot,
    regime,
    realizedVolBps: riskCtx.realizedVolBps,
    tickTravel24h: riskCtx.tickTravel24h,
    gasGwei: gas.gwei,
    feeYield24hUsd: yieldEstimate.feeYield24hUsd,
    summary,
    source: `${riskCtx.source}+${gas.source}+${yieldEstimate.source}`,
  };
}

const ScoutSchema = z.object({
  summary: z
    .string()
    .min(20)
    .max(220)
    .describe("One-paragraph regime read in plain English. Quote the numbers."),
});

// === SCOUT - CREATE ===

export interface ScoutCreateInput {
  start: CreateStart;
  // Defaults to the agent wallet's session chain.
  chainId: ChainId;
  channel: ThoughtChannel;
}

export async function runScoutCreate({
  start,
  chainId,
  channel,
}: ScoutCreateInput): Promise<CreateContext> {
  const goal = start.goal;
  await channel.emit({
    role: "scout",
    text: `surveying pools on chain ${chainId} for goal: ${describeGoal(goal)}`,
    tag: "tool:pool_discovery",
  });

  const pools = await discoverPools(chainId, {
    pinnedPair: goal.pinnedPair,
    pinnedFeeTier: goal.pinnedFeeTier,
    containingToken: goal.capital?.tokenSymbol,
  });

  if (pools.length === 0) {
    await channel.emit({
      role: "scout",
      text: `no live pools found on chain ${chainId} for ${goal.capital?.tokenSymbol ?? "the requested token"}. Try \`refresh pools\` or pick a different chain.`,
      tag: "no_pools",
    });
    throw new Error(
      `no pools discovered for chain ${chainId}${
        goal.capital?.tokenSymbol ? ` containing ${goal.capital.tokenSymbol.toUpperCase()}` : ""
      }`,
    );
  }

  const gas = await readGasGwei(chainId);
  await channel.emit({
    role: "scout",
    text: `${pools.length} live pools · gas ${gas.gwei.toFixed(2)}gwei (${gas.source})`,
    tag: "tool:gas",
  });

  // Stable/stable pairs fall through to the deterministic vol fallback (the
  // oracle keys on a non-stable subject token).
  const surveyedPools: SurveyedPool[] = await Promise.all(
    pools.map(async (entry) => {
      const synthetic = synthSnapshot(entry.pool);
      const riskCtx = await loadRiskContext(synthetic).catch(() => defaultRiskContext(synthetic));
      const yieldEst = estimate24hFeeYield({
        candidate: phantomCandidateForPool(entry.pool),
        pool: entry.pool,
        tickTravel24h: riskCtx.tickTravel24h,
      });
      const regime = classifyRegime({
        realizedVolBps: riskCtx.realizedVolBps,
        snapshot: synthetic,
        gasGwei: gas.gwei,
      });
      return {
        pool: entry.pool,
        realizedVolBps: riskCtx.realizedVolBps,
        tickTravel24h: riskCtx.tickTravel24h,
        feeYield24hUsd: yieldEst.feeYield24hUsd,
        regime,
      };
    }),
  );

  for (const sp of surveyedPools) {
    await channel.emit({
      role: "scout",
      text: `${sp.pool.token0.symbol}/${sp.pool.token1.symbol} ${(sp.pool.feeTier / 10_000).toFixed(2)}%  vol ${sp.realizedVolBps}bps  yield ~$${sp.feeYield24hUsd.toFixed(2)}/d  regime ${sp.regime}`,
      tag: "pool",
    });
  }

  let summary: string;
  if (agentsAvailable()) {
    const { output } = await runAgent({
      system: SCOUT_CREATE_SYSTEM,
      user: scoutCreateUserMessage({ goal, surveyedPools, gasGwei: gas.gwei }),
      schema: ScoutCreateSchema,
      schemaName: "scout_create_assessment",
      temperature: 0.3,
    });
    summary = output.summary;
  } else {
    const dominantRegime = pickDominantRegime(surveyedPools);
    summary = `${pools.length} pools surveyed · prevailing regime ${dominantRegime} (${regimeCaption(dominantRegime)}) · gas ${gas.gwei.toFixed(2)}gwei`;
  }
  await channel.emit({ role: "scout", text: summary, tag: "summary" });

  return {
    goal,
    surveyedPools,
    gasGwei: gas.gwei,
    summary,
    source: `pool-discovery+${gas.source}`,
  };
}

function describeGoal(goal: CreateStart["goal"]): string {
  const parts: string[] = [];
  if (goal.capital) parts.push(`${goal.capital.amount} ${goal.capital.tokenSymbol.toUpperCase()}`);
  if (goal.riskProfile) parts.push(goal.riskProfile);
  if (goal.exposurePreference) parts.push(goal.exposurePreference);
  if (goal.pinnedPair)
    parts.push(`${goal.pinnedPair.token0Symbol.toUpperCase()}/${goal.pinnedPair.token1Symbol.toUpperCase()}`);
  if (goal.pinnedFeeTier) parts.push(`${goal.pinnedFeeTier}bps`);
  return parts.join(", ") || "open exploration";
}

function pickDominantRegime(pools: SurveyedPool[]): SurveyedPool["regime"] {
  const counts: Record<string, number> = {};
  for (const p of pools) counts[p.regime] = (counts[p.regime] ?? 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (sorted[0]?.[0] ?? "ranging") as SurveyedPool["regime"];
}

const ScoutCreateSchema = z.object({
  summary: z
    .string()
    .min(20)
    .max(280)
    .describe("Plain-English regime overview across the surveyed pools. Quote the numbers."),
});

function synthSnapshot(pool: Pool): PositionSnapshot {
  return {
    takenAt: Date.now(),
    range: {
      inRange: true,
      distanceFromBoundary: pool.tickSpacing * 4,
      utilization: 0.5,
      priceLower: 0,
      priceUpper: 0,
      priceCurrent: pool.price,
    },
    position: {
      id: "synthetic",
      owner: ZERO_ADDRESS,
      tickLower: pool.currentTick - pool.tickSpacing * 4,
      tickUpper: pool.currentTick + pool.tickSpacing * 4,
      liquidity: pool.liquidity,
      amount0: "0",
      amount1: "0",
      feesOwed0: "0",
      feesOwed1: "0",
      pool,
    },
  };
}

function phantomCandidateForPool(pool: Pool) {
  return {
    kind: "hold" as const,
    tickLower: pool.currentTick - pool.tickSpacing * 4,
    tickUpper: pool.currentTick + pool.tickSpacing * 4,
    priceLower: 0,
    priceUpper: 0,
    deploy0: "0",
    deploy1: "0",
    residual0: "0",
    residual1: "0",
    rationale: "synthetic",
  };
}

// === SCOUT - REBALANCE helpers ===

function phantomCandidateForCurrent(snapshot: PositionSnapshot) {
  const { tickLower, tickUpper } = snapshot.position;
  return {
    kind: "hold" as const,
    tickLower,
    tickUpper,
    priceLower: snapshot.range.priceLower,
    priceUpper: snapshot.range.priceUpper,
    deploy0: "0",
    deploy1: "0",
    residual0: "0",
    residual1: "0",
    rationale: "current",
  };
}

export type { ThoughtChannel };
export { AgentThought };
