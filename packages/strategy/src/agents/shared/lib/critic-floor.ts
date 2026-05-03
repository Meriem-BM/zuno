import type { CandidateJudgment, Critique, RiskProfile } from "@zuno/core";
import type { StressProfile } from "./stress.js";
import { BUFFER_FLOOR_HOURS } from "./constants.js";

interface FloorMetric {
  index: number;
  stress: StressProfile;
}

// LLM Critics sometimes accept candidates that violate the deterministic
// stress floor (e.g. 0h buffer on testnet); downgrade those to veto so a
// broken candidate can't reach Arbiter labeled "Cleared the floor".
export function enforceCriticFloor(
  critique: Critique,
  metrics: readonly FloorMetric[],
  riskProfile: RiskProfile,
): Critique {
  const minBuffer = BUFFER_FLOOR_HOURS[riskProfile];
  const judgments: CandidateJudgment[] = critique.judgments.map((j) => {
    if (j.verdict !== "accept") return j;
    const m = metrics.find((mm) => mm.index === j.index);
    if (!m) return j;
    if (m.stress.base === 0) {
      return {
        ...j,
        verdict: "veto",
        reason: "accept overridden: stress base 0h - candidate range is out of current price",
      };
    }
    if (m.stress.double < minBuffer / 2) {
      return {
        ...j,
        verdict: "veto",
        reason: `accept overridden: 2× vol buffer ${m.stress.double.toFixed(1)}h < ${(minBuffer / 2).toFixed(1)}h half-floor`,
      };
    }
    return j;
  });
  const changed = judgments.some((j, i) => j.verdict !== critique.judgments[i]!.verdict);
  if (!changed) return critique;
  const accepts = judgments.filter((j) => j.verdict === "accept").length;
  const vetoes = judgments.filter((j) => j.verdict === "veto").length;
  const decision: Critique["decision"] =
    accepts > 0 ? "accept" : vetoes === judgments.length ? "veto_all" : "revise";
  return { ...critique, judgments, decision };
}
