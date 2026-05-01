import type { IntentKind } from "@zuno/strategy/intents";

export const NON_ACTIONABLE_INTENTS: ReadonlySet<IntentKind> = new Set<IntentKind>([
  "exit",
  "help",
  "unknown",
  "needs_clarification",
]);
