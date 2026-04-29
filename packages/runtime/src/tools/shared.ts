import type {
  ErrorCode,
  ConnectWalletData,
  ExecutionContext,
  ToolExecutionResult,
  ToolName,
} from "../contracts/types.js";
import { chainName, configuredWatchAddress, defaultChainId } from "@zuno/config";
import type { Address, ChainId } from "@zuno/core";

export function ok<T>(tool: ToolName, message: string, data: T): ToolExecutionResult<T> {
  return { tool, status: "success", message, data };
}

export function err(tool: ToolName, errorCode: ErrorCode, message: string): ToolExecutionResult {
  return { tool, status: "error", message, errorCode };
}

export function resolvePositionId(
  intent: { positionId?: string },
  ctx: ExecutionContext,
): string | undefined {
  return intent.positionId ?? ctx.session.lastPositionId ?? undefined;
}

export function resolvePlanId(
  intent: { planId?: string },
  ctx: ExecutionContext,
): string | undefined {
  return intent.planId ?? ctx.session.lastPlanId ?? undefined;
}

export function connectedWallet(ctx: ExecutionContext): ConnectWalletData | null {
  if (!ctx.session.walletAddress || !ctx.session.chainId) return null;
  return {
    watchAddress: ctx.session.watchAddress ?? ctx.session.walletAddress,
    walletAddress: ctx.session.walletAddress,
    chainId: ctx.session.chainId,
    chainName: `Chain ${ctx.session.chainId}`,
    signerMode: ctx.session.signerMode ?? "wallet",
  };
}

export interface ReadTarget {
  address: Address;
  chainId: ChainId;
  chainName: string;
  source: "input" | "session" | "env" | "wallet";
}

export function resolveReadTarget(
  intent: { walletAddress?: string },
  ctx: ExecutionContext,
): ReadTarget | null {
  const envAddress = configuredWatchAddress();
  const inputAddress = intent.walletAddress as Address | undefined;
  const address =
    inputAddress ?? ctx.session.watchAddress ?? envAddress ?? ctx.session.walletAddress;
  if (!address) return null;

  const source = inputAddress
    ? "input"
    : ctx.session.watchAddress
      ? "session"
      : envAddress
        ? "env"
        : "wallet";
  const chainId = ctx.session.chainId ?? defaultChainId();
  return { address, chainId, chainName: chainName(chainId), source };
}

export function missingReadTarget(tool: ToolName): ToolExecutionResult {
  return err(
    tool,
    "WATCH_ADDRESS_NOT_SET",
    'Paste a wallet address first, for example "show positions for 0x...".',
  );
}

export function planStore(ctx: ExecutionContext) {
  if (!ctx.planStore) throw new Error("plan store not configured");
  return ctx.planStore;
}

export function alertStore(ctx: ExecutionContext) {
  if (!ctx.alertStore) throw new Error("alert store not configured");
  return ctx.alertStore;
}
