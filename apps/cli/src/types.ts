import type { Intent } from "@zuno/intents";

export interface Turn {
  id: number;
  input: string;
  intent: Intent;
}

export type ScrollItem =
  | { kind: "welcome"; key: string }
  | { kind: "turn"; key: string; turn: Turn };
