import { z } from "zod";
import type { Intent, IntentKind } from "../contracts/types.js";

export const INTENT_KINDS = [
  "exit",
  "help",
  "connect_wallet",
  "show_watch_target",
  "show_balance",
  "create_position",
  "swap_tokens",
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
  "apply_plan",
  "agent_status",
  "show_peers",
  "show_logs",
  "monitor_wallet",
  "show_alerts",
  "unknown",
  "needs_clarification",
] as const satisfies readonly IntentKind[];

export const IntentSchema = z.object({
  intent: z.enum(INTENT_KINDS),
  confidence: z.number().min(0).max(1),
  positionId: z.string().nullish(),
  planId: z.string().nullish(),
  walletAddress: z.string().nullish(),
  signerMode: z.enum(["wallet", "enclave"]).nullish(),
  amount: z.string().nullish(),
  tokenSymbol: z.string().nullish(),
  clarification: z.string().nullish(),
});

export function toIntent(input: string, value: unknown): Intent | null {
  const parsed = IntentSchema.safeParse(value);
  if (!parsed.success) return null;

  const result: Intent = {
    intent: parsed.data.intent,
    rawInput: input,
    confidence: parsed.data.confidence,
  };
  if (parsed.data.positionId) result.positionId = parsed.data.positionId;
  if (parsed.data.planId) result.planId = parsed.data.planId;
  if (parsed.data.walletAddress) result.walletAddress = parsed.data.walletAddress;
  if (parsed.data.signerMode) result.signerMode = parsed.data.signerMode;
  if (parsed.data.amount) result.amount = parsed.data.amount;
  if (parsed.data.tokenSymbol) result.tokenSymbol = parsed.data.tokenSymbol;
  if (parsed.data.clarification) result.clarification = parsed.data.clarification;
  return result;
}
