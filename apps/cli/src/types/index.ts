import type { Intent } from "@zuno/strategy/intents";
import type { ToolExecutionResult } from "@zuno/runtime";
import type { SessionState } from "@zuno/core";

export interface Turn {
  id: number;
  input: string;
  intent: Intent;
  result?: ToolExecutionResult;
}

export interface Shell {
  snapshot: SessionState;
  turns: Turn[];
  draft: string;
  pending: string | null;
  fallbackActive: boolean;
  fallbackProvider: string | null;
  auth: AuthFlowState | null;
  setDraft: (value: string) => void;
  submit: (value: string) => void;
}

export type ScrollItem =
  | { kind: "welcome"; key: string }
  | { kind: "turn"; key: string; turn: Turn };

export type AuthFlowState =
  | { stage: "email"; error?: string }
  | { stage: "sending"; email: string }
  | { stage: "code"; email: string; error?: string }
  | { stage: "verifying"; email: string }
  | { stage: "done"; email: string }
  | { stage: "failed"; email?: string; error: string };
