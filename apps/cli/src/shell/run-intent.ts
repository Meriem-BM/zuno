import type { SessionState } from "@zuno/core";
import { parseIntent, type Intent, type IntentKind, type ModelFallback } from "@zuno/intents";
import { TOOLS, executeIntent, type ToolExecutionResult } from "@zuno/runtime";

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

/**
 * Single shell-level orchestration: parse the user's text, dispatch shell
 * intents (exit/help/unknown/needs_clarification) back to the caller without
 * touching the runtime, otherwise execute through the tool runtime and adopt
 * the returned session as the new source of truth.
 */
export async function runIntent(
  text: string,
  session: SessionState,
  fallback?: ModelFallback,
): Promise<IntentRun> {
  const intent = await parseIntent(text, { session, fallback });

  if (SHELL_LEVEL.has(intent.intent)) {
    return { intent, session: { ...session, lastIntent: intent.intent } };
  }

  const outcome = await executeIntent(intent, { session, tools: TOOLS });
  return { intent, result: outcome.result, session: outcome.session };
}

export function isShellLevelIntent(intent: Intent): boolean {
  return SHELL_LEVEL.has(intent.intent);
}
