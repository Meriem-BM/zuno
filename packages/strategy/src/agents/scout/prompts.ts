import type { CreateGoal, MarketRegime, PositionSnapshot, SurveyedPool } from "@zuno/core";
import type { GasReading } from "../shared/lib/gas.js";
import type { RiskContext } from "../../planner/index.js";
import { regimeCaption } from "../shared/lib/regime.js";

export const SCOUT_SYSTEM = `You are SCOUT, the market-context observer in a four-agent Uniswap LP debate.

Your job is the first turn of every flow:
- Read the position snapshot, realized volatility, gas price, and fee yield estimate.
- Classify the market regime: ranging, trending, volatile, or stressed.
- Write a single-paragraph plain-English summary that the strategist and critic will quote.

Style:
- Concrete numbers. Quote vol in bps, gas in gwei.
- One short paragraph (2-3 sentences). No bullets, no preamble.
- Do not propose a range. Do not give risk advice. You set the world; the next agents act in it.`;

interface ScoutPromptInput {
  snapshot: PositionSnapshot;
  riskCtx: RiskContext;
  gas: GasReading;
  regime: MarketRegime;
}

export function scoutUserMessage({ snapshot, riskCtx, gas, regime }: ScoutPromptInput): string {
  const pos = snapshot.position;
  const r = snapshot.range;
  return [
    `Pool: ${pos.pool.token0.symbol}/${pos.pool.token1.symbol} (fee ${pos.pool.feeTier / 10_000}%)`,
    `Position: ${pos.id}, range [${r.priceLower.toFixed(4)} → ${r.priceUpper.toFixed(4)}], current ${r.priceCurrent.toFixed(4)}`,
    `Status: ${r.inRange ? "in range" : "OUT OF RANGE"}, utilization ${(r.utilization * 100).toFixed(0)}%`,
    `Realized vol (24h): ${riskCtx.realizedVolBps} bps (source ${riskCtx.source})`,
    `Tick travel (24h): ${riskCtx.tickTravel24h} ticks`,
    `Gas: ${gas.gwei.toFixed(2)} gwei (source ${gas.source})`,
    `Computed regime: ${regime} - ${regimeCaption(regime)}.`,
    "",
    "Write the regime summary paragraph. Quote at least vol, gas, and range status.",
  ].join("\n");
}

export const SCOUT_CREATE_SYSTEM = `You are SCOUT in CREATE mode. The user wants to open a new LP position on Uniswap v4.

You receive:
- The user's CreateGoal (capital, risk profile, exposure preference, pinned pair / fee if any).
- A list of pools surveyed on-chain with each pool's vol, yield estimate, gas, and computed regime.

Your job:
- Write a single short paragraph (2-4 sentences) that an LP would actually find useful.
- Cite the pool count, the prevailing regime, gas, and the most-relevant pool's vol/yield numbers.
- Do NOT recommend a specific pool. The strategist does that next.
- Do NOT propose a range.
- Tone: terminal-grade, no marketing.`;

interface CreatePromptInput {
  goal: CreateGoal;
  surveyedPools: SurveyedPool[];
  gasGwei: number;
}

export function scoutCreateUserMessage({
  goal,
  surveyedPools,
  gasGwei,
}: CreatePromptInput): string {
  const lines: string[] = [];
  lines.push("Goal:");
  if (goal.capital)
    lines.push(`  capital: ${goal.capital.amount} ${goal.capital.tokenSymbol.toUpperCase()}`);
  if (goal.capital2)
    lines.push(`  capital2: ${goal.capital2.amount} ${goal.capital2.tokenSymbol.toUpperCase()}`);
  if (goal.riskProfile) lines.push(`  riskProfile: ${goal.riskProfile}`);
  if (goal.exposurePreference) lines.push(`  exposurePreference: ${goal.exposurePreference}`);
  if (goal.pinnedPair)
    lines.push(
      `  pinnedPair: ${goal.pinnedPair.token0Symbol.toUpperCase()}/${goal.pinnedPair.token1Symbol.toUpperCase()}`,
    );
  if (goal.pinnedFeeTier) lines.push(`  pinnedFeeTier: ${goal.pinnedFeeTier}`);
  lines.push("");
  lines.push(`Gas: ${gasGwei.toFixed(2)} gwei`);
  lines.push("");
  lines.push("Surveyed pools (on-chain probe of v4 PoolManager):");
  for (const sp of surveyedPools) {
    lines.push(
      `  ${sp.pool.token0.symbol}/${sp.pool.token1.symbol} ${(sp.pool.feeTier / 10_000).toFixed(2)}%  vol=${sp.realizedVolBps}bps  travel=${sp.tickTravel24h}t/24h  yield=$${sp.feeYield24hUsd.toFixed(2)}/d  regime=${sp.regime}`,
    );
  }
  lines.push("");
  lines.push("Write the regime overview paragraph.");
  return lines.join("\n");
}
