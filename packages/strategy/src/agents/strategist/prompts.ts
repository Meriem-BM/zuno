import type {
  CreateContext,
  CreateProposal,
  Critique,
  MarketContext,
  RebalanceProposal,
} from "@zuno/core";
import { regimeCaption } from "../shared/lib/regime.js";

export const STRATEGIST_SYSTEM = `You are STRATEGIST, the range proposer in a four-agent Uniswap LP debate.

Your job:
- Read scout's regime call and the position state.
- Propose 2-5 candidate ranges as (kind, widthMultiplier, centerOffsetTicks).
- Width is relative to the current position width - 1.0 keeps it, 1.4 widens 40%, 0.65 tightens 35%.
- centerOffsetTicks is the offset from the current tick. Use small offsets (rarely > tickSpacing × 8). 0 means "centered on current price".
- Your kinds: "tighten" (narrower than current), "widen" (wider), "shift" (moved center), "hold" (very close to current).

Constraints:
- Honor the regime. In a "stressed" regime, lean wider. In "ranging", a tighter band can win on fee density.
- Always include at least one defensive candidate (wider) when regime is volatile or stressed.
- Never propose a width below 0.3× or above 3.5×.
- Output one short rationale paragraph quoting the numbers from scout.

When revising:
- Read the critic's per-candidate judgments. Address every "revise" with a concrete change. Drop every "veto".
- Keep at least one candidate the critic accepted (if any) so we can converge.
- New rationale should explain what changed and why.`;

interface InitialInput {
  context: MarketContext;
}

export function strategistInitialUserMessage({ context }: InitialInput): string {
  return [
    "INITIAL PROPOSAL",
    "",
    `Scout summary: ${context.summary}`,
    `Regime: ${context.regime} - ${regimeCaption(context.regime)}`,
    `Realized vol (24h): ${context.realizedVolBps} bps`,
    `Tick travel (24h): ${context.tickTravel24h} ticks`,
    `Gas: ${context.gasGwei.toFixed(2)} gwei`,
    `Estimated 24h fee yield (current range): $${context.feeYield24hUsd.toFixed(2)}`,
    "",
    "Propose 2-5 candidates. Be specific in the rationale.",
  ].join("\n");
}

interface RevisionInput {
  context: MarketContext;
  priorProposal: RebalanceProposal;
  priorCritique: Critique;
}

export function strategistRevisionUserMessage({
  context,
  priorProposal,
  priorCritique,
}: RevisionInput): string {
  const lines = [
    `REVISION (round ${priorProposal.round + 1})`,
    "",
    `Scout summary: ${context.summary}`,
    `Regime: ${context.regime}`,
    "",
    "Prior candidates:",
    ...priorProposal.candidates.map(
      (c, i) =>
        `  [${i}] ${c.kind} width=${(c.tickUpper - c.tickLower).toString()}t price=[${c.priceLower.toFixed(4)}, ${c.priceUpper.toFixed(4)}]`,
    ),
    "",
    "Critic judgments:",
    ...priorCritique.judgments.map(
      (j) =>
        `  [${j.index}] ${j.verdict.toUpperCase()} - ${j.reason}${j.suggestion ? `  → suggest: ${j.suggestion}` : ""}`,
    ),
    "",
    `Critic rationale: ${priorCritique.rationale}`,
    "",
    "Revise the proposal. Address every revise/veto with a concrete change.",
  ];
  return lines.join("\n");
}

export const STRATEGIST_CREATE_SYSTEM = `You are STRATEGIST in CREATE mode. The user wants to OPEN a new Uniswap v4 LP position.

You receive:
- The user's CreateGoal (capital token + amount, riskProfile, exposurePreference, optional pinned pair / fee tier).
- A list of surveyed pools (each with vol, fee yield estimate, regime).

Your job:
- Propose 2-5 candidates as (poolIndex, widthMultiplier, centerOffsetTicks, exposureBias) tuples.
- poolIndex is the 0-based index into the surveyed pools list.
- widthMultiplier is relative to a (tickSpacing × 8) baseline:
    1.0 ≈ tightish for v4, 1.5 ≈ comfortable, 2.5+ ≈ wide.
- centerOffsetTicks: 0 = centered on current price. Use small offsets unless market is clearly trending.
- exposureBias:
    "neutral" = symmetric around current price (deposits ~50/50 in value).
    "long-token" = shift the range so the user's capital token sits MORE in the position.

Constraints:
- Honor the riskProfile:
    "conservative" / "passive" → wider (≥1.5×), pools with deeper liquidity preferred.
    "balanced" → balanced widths around 1.0×.
    "aggressive" / "yolo" → tighter (≤0.7×) acceptable.
- Honor exposurePreference:
    "stay-in-token" → propose at least one candidate with exposureBias="long-token".
    "neutral" → keep all candidates around the current price.
- If multiple pools are surveyed, vary poolIndex across candidates - don't propose 5 candidates all in pool 0.
- Output one rationale paragraph quoting at least one pool's vol/yield numbers and the goal.`;

interface CreateInitialInput {
  context: CreateContext;
}

export function strategistCreateInitialUserMessage({ context }: CreateInitialInput): string {
  const lines: string[] = [];
  lines.push("INITIAL PROPOSAL - CREATE");
  lines.push("");
  lines.push(`Scout summary: ${context.summary}`);
  lines.push("");
  lines.push("Goal:");
  if (context.goal.capital)
    lines.push(
      `  capital: ${context.goal.capital.amount} ${context.goal.capital.tokenSymbol.toUpperCase()}`,
    );
  if (context.goal.capital2)
    lines.push(
      `  capital2: ${context.goal.capital2.amount} ${context.goal.capital2.tokenSymbol.toUpperCase()}`,
    );
  if (context.goal.riskProfile) lines.push(`  riskProfile: ${context.goal.riskProfile}`);
  if (context.goal.exposurePreference)
    lines.push(`  exposurePreference: ${context.goal.exposurePreference}`);
  lines.push(`Gas: ${context.gasGwei.toFixed(2)} gwei`);
  lines.push("");
  lines.push("Surveyed pools:");
  context.surveyedPools.forEach((sp, i) => {
    lines.push(
      `  [${i}] ${sp.pool.token0.symbol}/${sp.pool.token1.symbol} ${(sp.pool.feeTier / 10_000).toFixed(2)}%  vol=${sp.realizedVolBps}bps  travel=${sp.tickTravel24h}t/24h  yield=$${sp.feeYield24hUsd.toFixed(2)}/d  regime=${sp.regime}  L=${sp.pool.liquidity}`,
    );
  });
  lines.push("");
  lines.push("Propose 2-5 candidates with rationale.");
  return lines.join("\n");
}

interface CreateRevisionInput {
  context: CreateContext;
  priorProposal: CreateProposal;
  priorCritique: Critique;
}

export function strategistCreateRevisionUserMessage({
  context,
  priorProposal,
  priorCritique,
}: CreateRevisionInput): string {
  const lines: string[] = [];
  lines.push(`REVISION (round ${priorProposal.round + 1}) - CREATE`);
  lines.push("");
  lines.push(`Scout summary: ${context.summary}`);
  lines.push("");
  lines.push("Prior candidates:");
  priorProposal.candidates.forEach((c, i) => {
    const pool = context.surveyedPools[c.poolIndex]?.pool;
    const label = pool
      ? `${pool.token0.symbol}/${pool.token1.symbol} ${(pool.feeTier / 10_000).toFixed(2)}%`
      : `pool[${c.poolIndex}]`;
    lines.push(
      `  [${i}] ${label} width=${(c.tickUpper - c.tickLower).toString()}t [${c.priceLower.toFixed(4)}, ${c.priceUpper.toFixed(4)}]  yield $${c.expectedYield24hUsd.toFixed(2)}/d`,
    );
  });
  lines.push("");
  lines.push("Critic judgments:");
  priorCritique.judgments.forEach((j) =>
    lines.push(
      `  [${j.index}] ${j.verdict.toUpperCase()} - ${j.reason}${j.suggestion ? `  → suggest: ${j.suggestion}` : ""}`,
    ),
  );
  lines.push("");
  lines.push(`Critic rationale: ${priorCritique.rationale}`);
  lines.push("");
  lines.push("Revise the proposal. Address every revise/veto with a concrete change.");
  return lines.join("\n");
}
