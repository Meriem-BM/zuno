import type { Intent } from "@zuno/intents";
import type { ToolExecutionResult } from "@zuno/runtime";

export interface Turn {
  id: number;
  input: string;
  intent: Intent;
  result?: ToolExecutionResult;
}

export type ScrollItem =
  | { kind: "welcome"; key: string }
  | { kind: "turn"; key: string; turn: Turn };
