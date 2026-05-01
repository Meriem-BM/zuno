import type { SessionState } from "@zuno/core";
import type { Intent, PendingClarification } from "../contracts/types.js";
import { validateIntent } from "./validation.js";

export function tryResumePending(
  rawInput: string,
  pending: PendingClarification,
  session: SessionState | undefined,
): Intent | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const filled = fillFromAnswer(trimmed, pending);
  if (!filled) return null;

  const merged: Intent = {
    intent: pending.intent,
    rawInput: trimmed,
    confidence: 0.85,
    positionId: pending.positionId,
    planId: pending.planId,
    ...filled,
  };
  if (session) {
    if (!merged.positionId && session.lastPositionId) merged.positionId = session.lastPositionId;
    if (!merged.planId && session.lastPlanId) merged.planId = session.lastPlanId;
  }
  return validateIntent(merged);
}

function fillFromAnswer(input: string, pending: PendingClarification): Partial<Intent> | null {
  const text = input.trim();
  switch (pending.field) {
    case "positionId": {
      const m = text.match(/^(pos_[a-z0-9]+|\d+|[a-z0-9_-]{2,32})$/iu);
      if (m) return { positionId: m[1] };
      return null;
    }
    case "planId": {
      const m = text.match(/^(plan_[a-z0-9]+|[a-z0-9_-]{4,40})$/iu);
      if (m) return { planId: m[1] };
      return null;
    }
  }
}
