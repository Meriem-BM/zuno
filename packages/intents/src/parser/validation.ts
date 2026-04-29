import type { ClarificationField, Intent } from "../contracts/types.js";
import { PLAN_INTENTS, POSITION_INTENTS, REQUIRED_FIELDS } from "./rules.js";

export function validateIntent(intent: Intent): Intent {
  const validate = REQUIRED_FIELDS[intent.intent];
  if (!validate) return intent;
  const clarification = validate(intent);
  if (!clarification) return intent;

  return {
    intent: "needs_clarification",
    rawInput: intent.rawInput,
    confidence: Math.min(0.4, intent.confidence * 0.5),
    clarification,
    pendingIntent: intent.intent,
    pendingField: missingField(intent),
    positionId: intent.positionId,
    planId: intent.planId,
    signerMode: intent.signerMode,
  };
}

function missingField(intent: Intent): ClarificationField {
  if (POSITION_INTENTS.has(intent.intent) && !intent.positionId) return "positionId";
  if (PLAN_INTENTS.has(intent.intent) && !intent.planId) return "planId";
  if (intent.intent === "apply_plan") {
    if (!intent.planId) return "planId";
    if (!intent.signerMode) return "signerMode";
  }
  return "positionId";
}
