import type { Address, ChainId, SessionState, SignerMode } from "@zuno/core";
import type { Intent, IntentKind } from "@zuno/intents";

export type ToolName =
  | "connectWallet"
  | "showWalletBalance"
  | "listWalletPositions"
  | "inspectPosition"
  | "inspectAllPositions"
  | "checkRangeStatus"
  | "listOutOfRangePositions"
  | "listRiskyPositions"
  | "recommendRebalance"
  | "showRebalanceOptions"
  | "explainRecommendation"
  | "showPlanDiff"
  | "simulatePlan"
  | "applyPlan"
  | "showAgentStatus"
  | "showPeers"
  | "showLogs";

export type ToolExecutionStatus = "success" | "error";

export type ErrorCode =
  | "POSITION_NOT_FOUND"
  | "PLAN_NOT_FOUND"
  | "WALLET_NOT_CONNECTED"
  | "SIGNER_NOT_SPECIFIED"
  | "TOOL_NOT_MAPPED"
  | "TOOL_EXECUTION_FAILED"
  | "INTENT_NOT_ACTIONABLE";

export interface ToolExecutionResult<TData = unknown> {
  tool: ToolName | "unknown";
  status: ToolExecutionStatus;
  message: string;
  data?: TData;
  errorCode?: ErrorCode;
}

export interface ToolDefinition<TData = unknown> {
  name: ToolName;
  intents: IntentKind[];
  execute: (
    intent: Intent,
    context: ExecutionContext,
  ) => Promise<ToolExecutionResult<TData>> | ToolExecutionResult<TData>;
}

export type ToolRegistry = readonly ToolDefinition[];

export interface ExecutionContext {
  session: SessionState;
  tools: ToolRegistry;
}

export interface ExecutorOutcome {
  result: ToolExecutionResult;
  session: SessionState;
}

/* Data shapes returned by tools that participate in session updates. */

export interface ConnectWalletData {
  walletAddress: Address;
  chainId: ChainId;
  signerMode: SignerMode;
}

export interface InspectPositionData {
  positionId: string;
  pair: string;
  feeTier: number;
  rangeStatus: "IN_RANGE" | "OUT_OF_RANGE";
  priceLower: number;
  priceUpper: number;
  priceCurrent: number;
}

export interface RecommendRebalanceData {
  planId: string;
  positionId: string;
  recommended: { kind: string; priceLower: number; priceUpper: number };
  rejected?: { kind: string; priceLower: number; priceUpper: number };
  rejectReason?: string;
  reason: string;
}

export interface ApplyPlanData {
  planId: string;
  txHash: string;
  signerMode: SignerMode;
  status: "submitted" | "confirmed";
}
