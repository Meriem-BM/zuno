import type {
  CreateProposal,
  MarketContext,
  RebalanceProposal,
  RiskProfile,
} from "@zuno/core";
import type { CandidateMetrics, CreateCandidateMetrics } from "./handler.js";
import { regimeCaption } from "../shared/lib/regime.js";

export const CRITIC_SYSTEM = `You are RISK-CRITIC, the adversary in a four-agent Uniswap LP debate.

Your job:
- Challenge every candidate the strategist proposes. Default skeptical.
- For each candidate, you receive deterministic stress numbers:
    base buffer hours (current vol)
    2× vol buffer
    3× vol buffer
    gas/yield ratio (rebalance cost / 24h fee yield estimate)
- Give every candidate one of: accept, revise, veto.
- "veto" is the strong move - only when the numbers genuinely fail.
- "revise" is the productive move - say what to change ("widen width 30%", "wait for gas under 20gwei").
- Pick "accept" when buffer ≥ profile floor AND gas/yield is acceptable AND 2× vol still survives.

Risk profile guides the floor:
- conservative: ≥36h base buffer, gas/yield ≤1.2x, must survive 2× vol
- balanced:     ≥24h base buffer, gas/yield ≤1.6x, must survive 2× vol
- aggressive:   ≥14h base buffer, gas/yield ≤2.4x, may take 3× vol risk

Style:
- Cite the actual buffer hours and ratios in every reason. No hand-waving.
- Overall decision: "accept" if at least one candidate accepted; "veto_all" if every candidate vetoed; "revise" otherwise.`;

interface UserInput {
  context: MarketContext;
  proposal: RebalanceProposal;
  metrics: CandidateMetrics[];
  riskProfile: RiskProfile;
}

export function criticUserMessage({ context, proposal, metrics, riskProfile }: UserInput): string {
  const lines = [
    `Round: ${proposal.round}  ·  Risk profile: ${riskProfile}`,
    "",
    `Scout summary: ${context.summary}`,
    `Regime: ${context.regime} (${regimeCaption(context.regime)}) · vol=${context.realizedVolBps}bps · gas=${context.gasGwei.toFixed(2)}gwei`,
    "",
    "Strategist rationale:",
    `  ${proposal.rationale}`,
    "",
    "Candidates with deterministic stress:",
    ...metrics.map(
      (m) =>
        `  [${m.index}] ${m.candidate.kind} width=${m.candidate.tickUpper - m.candidate.tickLower}t price=[${m.candidate.priceLower.toFixed(4)}, ${m.candidate.priceUpper.toFixed(4)}]\n` +
        `       base=${fmt(m.stress.base)}h  2×=${fmt(m.stress.double)}h  3×=${fmt(m.stress.triple)}h  yield=$${m.yieldUsd.toFixed(2)}/d  gas/yield=${fmtRatio(m.gasYield)}x`,
    ),
    "",
    "Judge each by index. Use the floor for the given risk profile. Be specific in suggestions.",
  ];
  return lines.join("\n");
}

function fmt(h: number): string {
  if (!Number.isFinite(h)) return "∞";
  if (h < 1) return `${(h * 60).toFixed(0)}m`;
  return h.toFixed(0);
}

function fmtRatio(r: number): string {
  if (!Number.isFinite(r)) return "∞";
  return r.toFixed(2);
}

// === CREATE ===

export const CRITIC_CREATE_SYSTEM = `You are RISK-CRITIC for a CREATE flow. The strategist is proposing brand-new positions; you are the adversary.

You receive:
- The user's CreateGoal (capital token + amount, riskProfile, exposurePreference, optional pinned pair / fee).
- A list of pool/range candidates with deterministic stress: base buffer hours (current vol), 2× and 3× vol buffer, gas/yield ratio.

Judge each candidate as accept | revise | veto:
- veto: 2× vol buffer < half the profile floor, or candidate's range starts inactive at current price.
- revise: base buffer below floor, OR gas/yield above ceiling. Say what to change ("widen 30%", "pick a calmer pool").
- accept: buffer ≥ floor AND gas/yield acceptable AND 2× vol survives.

Profile floors:
- conservative: ≥36h base buffer, gas/yield ≤1.2x, must survive 2× vol
- balanced:     ≥24h base buffer, gas/yield ≤1.6x, must survive 2× vol
- aggressive:   ≥14h base buffer, gas/yield ≤2.4x, may take 3× vol risk

Special:
- If the goal says "stay-in-token" but a candidate's range pulls capital into the OTHER token significantly, prefer "revise" with a suggestion to use exposureBias=long-token.
- If a candidate has a costly prepAction (swap before mint), call that out - it's real cost the user pays.

Style:
- Cite buffer hours and gas/yield in every reason. No hand-waving. Reference pool labels (token0/token1 fee%) so the user can match candidates to pools.`;

interface CreateUserInput {
  proposal: CreateProposal;
  metrics: CreateCandidateMetrics[];
  riskProfile: RiskProfile;
}

export function criticCreateUserMessage({
  proposal,
  metrics,
  riskProfile,
}: CreateUserInput): string {
  const lines: string[] = [];
  lines.push(`Round: ${proposal.round}  ·  Risk profile: ${riskProfile}`);
  lines.push("");
  lines.push(`Scout summary: ${proposal.context.summary}`);
  lines.push(`Gas: ${proposal.context.gasGwei.toFixed(2)} gwei`);
  lines.push("");
  lines.push("Strategist rationale:");
  lines.push(`  ${proposal.rationale}`);
  lines.push("");
  lines.push("Goal:");
  if (proposal.context.goal.capital)
    lines.push(
      `  capital: ${proposal.context.goal.capital.amount} ${proposal.context.goal.capital.tokenSymbol.toUpperCase()}`,
    );
  if (proposal.context.goal.riskProfile)
    lines.push(`  riskProfile: ${proposal.context.goal.riskProfile}`);
  if (proposal.context.goal.exposurePreference)
    lines.push(`  exposurePreference: ${proposal.context.goal.exposurePreference}`);
  lines.push("");
  lines.push("Candidates with deterministic stress:");
  for (const m of metrics) {
    const pool = proposal.context.surveyedPools[m.candidate.poolIndex]!.pool;
    lines.push(
      `  [${m.index}] ${pool.token0.symbol}/${pool.token1.symbol} ${(pool.feeTier / 10_000).toFixed(2)}%  ` +
        `width=${m.candidate.tickUpper - m.candidate.tickLower}t  ` +
        `[${m.candidate.priceLower.toFixed(4)}, ${m.candidate.priceUpper.toFixed(4)}]\n       ` +
        `base=${fmt(m.stress.base)}h  2×=${fmt(m.stress.double)}h  3×=${fmt(m.stress.triple)}h  ` +
        `yield=$${m.candidate.expectedYield24hUsd.toFixed(2)}/d  gas/yield=${fmtRatio(m.gasYield)}x` +
        (m.candidate.prepAction ? `  · prep: ${m.candidate.prepAction}` : ""),
    );
  }
  lines.push("");
  lines.push("Judge each by index. Be specific in suggestions.");
  return lines.join("\n");
}
