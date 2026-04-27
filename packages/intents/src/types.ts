export type IntentKind =
  | "connect_wallet"
  | "show_balance"
  | "list_positions"
  | "inspect_position"
  | "recommend_rebalance"
  | "show_diff"
  | "simulate_plan"
  | "apply_plan"
  | "agent_status"
  | "show_peers"
  | "help"
  | "exit"
  | "unknown";

export interface Intent {
  intent: IntentKind;
  rawInput: string;
  positionId?: string;
  planId?: string;
}
