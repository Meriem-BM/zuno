import type { SessionState } from "@zuno/core";

export type IntentKind =
  | "exit"
  | "help"
  | "create_agent_wallet"
  | "show_agent_wallet"
  | "show_agent_wallet_balance"
  | "show_balances"
  | "show_network"
  | "switch_network"
  | "show_allowances"
  | "fund_agent_wallet"
  | "create_position"
  | "swap_tokens"
  | "prepare_swap"
  | "show_quote"
  | "approve_token"
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
  | "approve_plan"
  | "apply_plan"
  | "agent_status"
  | "show_peers"
  | "show_logs"
  | "monitor_wallet"
  | "show_alerts"
  | "unknown"
  | "needs_clarification";

export type ClarificationField = "positionId" | "planId";

export interface PendingClarification {
  intent: IntentKind;
  field: ClarificationField;
  positionId?: string;
  planId?: string;
}

export interface Entities {
  positionId?: string;
  planId?: string;
  walletAddress?: string;
  tokenSymbol?: string;
  tokenOutSymbol?: string;
  amount?: string;
  chainName?: string;
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
