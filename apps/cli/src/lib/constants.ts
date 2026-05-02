import type { IntentKind } from "@zuno/strategy/intents";

export const SHELL_LEVEL_INTENTS: ReadonlySet<IntentKind> = new Set<IntentKind>([
  "exit",
  "help",
  "unknown",
  "needs_clarification",
]);

export const HELP_LINES: ReadonlyArray<string> = [
  "create my zuno wallet",
  "show my balances",
  "what network am I on   ·   switch to arbitrum or sepolia",
  "show my allowances",
  "inspect my positions",
  "inspect position 42",
  "are any positions out of range",
  "recommend what I should do with this position",
  "show me the diff   ·   simulate it",
  "approve it   ·   apply it",
  "swap 1 ETH to USDC   ·   approve it   ·   apply it",
  "show alerts",
  "agent status   ·   show peers   ·   show logs",
];

export const WALLET_INTENTS: ReadonlySet<IntentKind> = new Set<IntentKind>([
  "create_agent_wallet",
  "show_agent_wallet",
  "show_agent_wallet_balance",
  "show_balances",
  "show_allowances",
  "prepare_swap",
  "show_quote",
  "swap_tokens",
  "approve_token",
  "fund_agent_wallet",
  "list_positions",
  "inspect_position",
  "inspect_all_positions",
  "check_range_status",
  "list_out_of_range_positions",
  "list_risky_positions",
  "recommend_rebalance",
  "show_rebalance_options",
  "explain_recommendation",
  "show_diff",
  "simulate_plan",
  "approve_plan",
  "apply_plan",
  "monitor_wallet",
]);
