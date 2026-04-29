import type { SessionState, SignerMode } from "@zuno/core";

export type IntentKind =
  | "exit"
  | "help"
  | "connect_wallet"
  | "show_watch_target"
  | "show_balance"
  | "create_position"
  | "swap_tokens"
  | "list_positions"
  | "inspect_position"
  | "inspect_all_positions"
  | "check_range_status"
  | "list_out_of_range_positions"
  | "list_risky_positions"
  | "recommend_rebalance"
  | "show_rebalance_options"
  | "explain_recommendation"
  | "show_diff"
  | "simulate_plan"
  | "apply_plan"
  | "agent_status"
  | "show_peers"
  | "show_logs"
  | "monitor_wallet"
  | "show_alerts"
  | "unknown"
  | "needs_clarification";

export type ClarificationField = "positionId" | "planId" | "signerMode";

export interface PendingClarification {
  intent: IntentKind;
  field: ClarificationField;
  positionId?: string;
  planId?: string;
  signerMode?: SignerMode;
}

export interface Entities {
  positionId?: string;
  planId?: string;
  walletAddress?: string;
  tokenSymbol?: string;
  amount?: string;
  signerMode?: SignerMode;
}

export interface Intent extends Entities {
  intent: IntentKind;
  rawInput: string;
  confidence: number;
  clarification?: string;
  pendingIntent?: IntentKind;
  pendingField?: ClarificationField;
  corrections?: string[];
}

export interface IntentScore {
  intent: IntentKind;
  score: number;
}

export interface ModelFallback {
  parse(input: string, session?: SessionState): Promise<Intent | null>;
}

export interface ParseOptions {
  session?: SessionState;
  fallback?: ModelFallback;
  pending?: PendingClarification;
}
