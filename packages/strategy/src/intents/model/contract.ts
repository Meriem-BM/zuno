import { z } from "zod";
import type { Intent, IntentKind } from "../contracts/types.js";

export const INTENT_KINDS = [
  "exit",
  "help",
  "create_agent_wallet",
  "show_agent_wallet",
  "show_agent_wallet_balance",
  "show_balances",
  "show_network",
  "switch_network",
  "show_allowances",
  "fund_agent_wallet",
  "create_position",
  "swap_tokens",
  "prepare_swap",
  "show_quote",
  "approve_token",
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
  "agent_status",
  "show_peers",
  "show_logs",
  "refresh_pools",
  "monitor_wallet",
  "show_alerts",
  "unknown",
  "needs_clarification",
] as const satisfies readonly IntentKind[];

const RiskProfileEnum = z.enum(["conservative", "balanced", "aggressive"]);
const ExposureEnum = z.enum(["stay-in-token", "neutral"]);

const CreateGoalSchema = z.object({
  capital: z
    .object({
      tokenSymbol: z.string().nullish(),
      amount: z.string().nullish(),
    })
    .nullish(),
  riskProfile: RiskProfileEnum.nullish(),
  exposurePreference: ExposureEnum.nullish(),
  pinnedPair: z
    .object({
      token0Symbol: z.string(),
      token1Symbol: z.string(),
    })
    .nullish(),
  pinnedFeeTier: z.number().int().positive().nullish(),
});

export const IntentSchema = z.object({
  intent: z.enum(INTENT_KINDS),
  confidence: z.number().min(0).max(1),
  positionId: z.string().nullish(),
  planId: z.string().nullish(),
  walletAddress: z.string().nullish(),
  amount: z.string().nullish(),
  tokenSymbol: z.string().nullish(),
  tokenOutSymbol: z.string().nullish(),
  chainName: z.string().nullish(),
  clarification: z.string().nullish(),
  // Filled when intent === "create_position". May be partial.
  createGoal: CreateGoalSchema.nullish(),
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
  if (parsed.data.amount) result.amount = parsed.data.amount;
  if (parsed.data.tokenSymbol) result.tokenSymbol = parsed.data.tokenSymbol;
  if (parsed.data.tokenOutSymbol) result.tokenOutSymbol = parsed.data.tokenOutSymbol;
  if (parsed.data.chainName) result.chainName = parsed.data.chainName;
  if (parsed.data.clarification) result.clarification = parsed.data.clarification;
  if (parsed.data.createGoal) {
    const cleaned = cleanCreateGoal(parsed.data.createGoal);
    if (Object.keys(cleaned).length > 0) result.createGoal = cleaned;
  }
  return result;
}

type RawCreateGoal = z.infer<typeof CreateGoalSchema>;

function cleanCreateGoal(raw: RawCreateGoal): Intent["createGoal"] & object {
  const out: NonNullable<Intent["createGoal"]> = {};
  if (raw.capital) {
    const capital: { tokenSymbol?: string; amount?: string } = {};
    if (raw.capital.tokenSymbol) capital.tokenSymbol = raw.capital.tokenSymbol.toLowerCase();
    if (raw.capital.amount) capital.amount = raw.capital.amount.replace(",", ".");
    if (capital.tokenSymbol || capital.amount) {
      out.capital = {
        tokenSymbol: capital.tokenSymbol ?? "",
        amount: capital.amount ?? "",
      };
    }
  }
  if (raw.riskProfile) out.riskProfile = raw.riskProfile;
  if (raw.exposurePreference) out.exposurePreference = raw.exposurePreference;
  if (raw.pinnedPair) {
    out.pinnedPair = {
      token0Symbol: raw.pinnedPair.token0Symbol.toLowerCase(),
      token1Symbol: raw.pinnedPair.token1Symbol.toLowerCase(),
    };
  }
  if (raw.pinnedFeeTier) out.pinnedFeeTier = raw.pinnedFeeTier;
  return out;
}
