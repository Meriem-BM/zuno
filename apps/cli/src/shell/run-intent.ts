import type { SessionState } from "@zuno/core";
import {
  parseIntent,
  type Intent,
  type IntentKind,
  type ModelFallback,
  type PendingClarification,
} from "@zuno/intents";
import {
  TOOLS,
  executeIntent,
  type ExecutionContext,
  type ToolExecutionResult,
  type ToolRegistry,
} from "@zuno/runtime";

const SHELL_LEVEL: ReadonlySet<IntentKind> = new Set<IntentKind>([
  "exit",
  "help",
  "unknown",
  "needs_clarification",
]);

export interface IntentRun {
  intent: Intent;
  result?: ToolExecutionResult;
  session: SessionState;
}

export interface RunIntentOptions {
  fallback?: ModelFallback;
  pending?: PendingClarification;
  tools?: ToolRegistry;
  planStore?: ExecutionContext["planStore"];
  alertStore?: ExecutionContext["alertStore"];
}

export async function runIntent(
  text: string,
  session: SessionState,
  options: RunIntentOptions = {},
): Promise<IntentRun> {
  const intent = await parseIntent(text, {
    session,
    fallback: options.fallback,
    pending: options.pending,
  });

  if (SHELL_LEVEL.has(intent.intent)) {
    return { intent, session: { ...session, lastIntent: intent.intent } };
  }

  const outcome = await executeIntent(intent, {
    session,
    tools: options.tools ?? TOOLS,
    planStore: options.planStore,
    alertStore: options.alertStore,
  });
  return { intent, result: outcome.result, session: outcome.session };
}

export function isShellLevelIntent(intent: Intent): boolean {
  return SHELL_LEVEL.has(intent.intent);
}

export function pendingFromIntent(intent: Intent): PendingClarification | null {
  if (intent.intent !== "needs_clarification" || !intent.pendingIntent || !intent.pendingField) {
    return null;
  }
  return {
    intent: intent.pendingIntent,
    field: intent.pendingField,
    positionId: intent.positionId,
    planId: intent.planId,
    signerMode: intent.signerMode,
  };
}
