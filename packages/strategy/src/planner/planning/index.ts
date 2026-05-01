import { newPlanId } from "@zuno/core";
import type { Plan, PositionSnapshot } from "@zuno/core";
import { critiqueWithContext } from "./critique.js";
import { proposeCandidates } from "./candidates.js";
import { defaultRiskContext } from "./risk-context.js";
import type { RiskContext } from "./risk-context.js";

export { DEFAULT_SLIPPAGE_BPS, proposeCandidates } from "./candidates.js";
export { critiqueCandidates, critiqueWithContext, MIN_BUFFER_HOURS } from "./critique.js";
export type { CritiqueResult } from "./critique.js";
export { buildPlanDiff } from "./diff.js";
export { defaultRiskContext } from "./risk-context.js";
export type { RiskContext } from "./risk-context.js";

export function recommendPlan(snapshot: PositionSnapshot, context?: RiskContext): Plan {
  const candidates = proposeCandidates(snapshot);
  const reviewed = critiqueWithContext(
    snapshot,
    candidates,
    context ?? defaultRiskContext(snapshot),
  );
  return {
    id: newPlanId(),
    positionId: snapshot.position.id,
    createdAt: Date.now(),
    snapshot,
    ...reviewed,
  };
}
