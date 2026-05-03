import { formatUnits } from "viem";
import type {
  ErrorCode,
  ExecutionContext,
  NeedsConfirmationData,
  ToolExecutionResult,
  ToolName,
} from "../contracts/types.js";
import { chainName, defaultChainId } from "@zuno/chain/config";
import type { Address, ChainId } from "@zuno/core";

export function ok<T>(tool: ToolName, message: string, data: T): ToolExecutionResult<T> {
  return { tool, status: "success", message, data };
}

export function err<T = never>(
  tool: ToolName,
  errorCode: ErrorCode,
  message: string,
): ToolExecutionResult<T> {
  return { tool, status: "error", message, errorCode };
}

export function resolvePositionId(
  intent: { positionId?: string },
  ctx: ExecutionContext,
): string | undefined {
  if (isPositionTokenId(intent.positionId)) return intent.positionId;
  if (isPositionTokenId(ctx.session.lastPositionId)) return ctx.session.lastPositionId;
  return undefined;
}

export function resolvePlanId(
  intent: { planId?: string },
  ctx: ExecutionContext,
): string | undefined {
  return intent.planId ?? ctx.session.lastPlanId ?? undefined;
}

export function resolveActionId(
  intent: { planId?: string },
  ctx: ExecutionContext,
): string | undefined {
  return intent.planId ?? ctx.session.lastActionId ?? ctx.session.lastPlanId ?? undefined;
}

export interface ReadTarget {
  address: Address;
  chainId: ChainId;
  chainName: string;
  source: "agent_wallet";
}

export function resolveAgentWallet(ctx: ExecutionContext): ReadTarget | null {
  const address = ctx.session.agentWalletAddress;
  if (!address) return null;
  const chainId = ctx.session.chainId ?? defaultChainId();
  return { address, chainId, chainName: chainName(chainId), source: "agent_wallet" };
}

export function missingAgentWallet<T = never>(tool: ToolName): ToolExecutionResult<T> {
  return err(
    tool,
    "AGENT_WALLET_NOT_FOUND",
    'Create or attach your Zuno wallet first, for example "create my zuno wallet".',
  );
}

export function walletService(ctx: ExecutionContext) {
  if (!ctx.walletService) {
    throw new Error(
      "Wallet service not configured; sign in with email OTP before invoking wallet tools.",
    );
  }
  return ctx.walletService;
}

export function planStore(ctx: ExecutionContext) {
  if (!ctx.planStore) throw new Error("plan store not configured");
  return ctx.planStore;
}

export function alertStore(ctx: ExecutionContext) {
  if (!ctx.alertStore) throw new Error("alert store not configured");
  return ctx.alertStore;
}

export function preparedActionStore(ctx: ExecutionContext) {
  if (!ctx.preparedActionStore) throw new Error("prepared action store not configured");
  return ctx.preparedActionStore;
}

function isPositionTokenId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d+$/u.test(value);
}

export function needsConfirmation<TSummary, TData = NeedsConfirmationData<TSummary>>(
  tool: ToolName,
  message: string,
  data: TData,
): ToolExecutionResult<TData> {
  return { tool, status: "needs_confirmation", message, data };
}

export function formatAmount(atomic: string, decimals: number): string {
  if (!atomic) return "0";
  let raw: bigint;
  try {
    raw = BigInt(atomic);
  } catch {
    return atomic;
  }
  if (raw === 0n) return "0";
  const human = formatUnits(raw, decimals);
  if (!human.includes(".")) return human;
  const [whole, frac = ""] = human.split(".");
  const trimmed = (frac + "000000").slice(0, 6);
  return `${whole}.${trimmed}`;
}
