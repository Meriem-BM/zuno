import type { Critique, RebalanceProposal, RiskProfile } from "@zuno/core";

export const ARBITER_SYSTEM = `You are ARBITER, the deadlock-breaker in a four-agent Uniswap LP debate.

You are called when STRATEGIST and CRITIC disagreed after multiple rounds.
Your job:
- Read the full debate (every proposal and every critique).
- Pick exactly one candidate from the LATEST proposal.
- Decide a verdict: approve, approve_with_caution, or reject.
- Set a confidence in [0, 1].
- Write one paragraph of reasoning that quotes specific debate turns.

Tiebreak rules:
- Honor the user's risk profile.
  - conservative: prefer the largest 2× vol buffer, lowest gas/yield. If nothing clears the bar, reject.
  - balanced:     pick the candidate with the best balance of buffer and yield. accept_with_caution is fine.
  - aggressive:   prefer the highest yield among non-vetoed candidates, even if buffer is tighter.
- If the critic vetoed every candidate in the latest round, return "reject" verdict - but still pick the least-bad index so the CLI can show the user what was on the table.
- If at least one candidate was "accept"-ed, you should normally pick that one and verdict "approve".

Style:
- Reference actual numbers from the debate (buffer hours, gas/yield ratios).
- Acknowledge the disagreement explicitly. The user is reading this.`;

interface UserInput {
  history: Array<{ proposal: RebalanceProposal; critique: Critique }>;
  riskProfile: RiskProfile;
}

export function arbiterUserMessage({ history, riskProfile }: UserInput): string {
  const lines: string[] = [];
  lines.push(`Risk profile: ${riskProfile}`);
  lines.push("");
  history.forEach(({ proposal, critique }, round) => {
    lines.push(`=== ROUND ${round} ===`);
    lines.push(`Strategist: ${proposal.rationale}`);
    proposal.candidates.forEach((c, i) => {
      lines.push(
        `  [${i}] ${c.kind} width=${c.tickUpper - c.tickLower}t [${c.priceLower.toFixed(4)}, ${c.priceUpper.toFixed(4)}]`,
      );
    });
    lines.push(`Critic decision: ${critique.decision} - ${critique.rationale}`);
    critique.judgments.forEach((j) => {
      lines.push(
        `  [${j.index}] ${j.verdict.toUpperCase()} - ${j.reason}${j.stressBufferHours !== undefined ? `  (2× buffer ${j.stressBufferHours.toFixed(0)}h)` : ""}${j.suggestion ? `  → ${j.suggestion}` : ""}`,
      );
    });
    lines.push("");
  });
  lines.push("Pick one candidate from the LATEST proposal. Index is 0-based.");
  return lines.join("\n");
}
