import type { Address, ChainId, SessionState, SignerMode } from "@zuno/core";
import type { PositionAlert } from "@zuno/core";
import type { Intent, IntentKind } from "@zuno/intents";
import type { AlertStore, PlanStore } from "@zuno/storage";

export type ToolName =
  | "connectWallet"
  | "showWatchTarget"
  | "showWalletBalance"
  | "createPosition"
  | "swapTokens"
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
  | "showLogs"
  | "monitorWallet"
  | "showAlerts";

export type ToolExecutionStatus = "success" | "error";

export type ErrorCode =
  | "POSITION_NOT_FOUND"
  | "PLAN_NOT_FOUND"
  | "WATCH_ADDRESS_NOT_SET"
  | "WALLET_NOT_CONNECTED"
  | "WALLET_CONNECTION_CANCELLED"
  | "WALLET_CONNECTION_FAILED"
  | "WALLET_CONNECTION_TIMEOUT"
  | "CHAIN_READ_FAILED"
  | "PLAN_REJECTED"
  | "EXECUTION_NOT_AVAILABLE"
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
  planStore?: PlanStore;
  alertStore?: AlertStore;
}

export interface ExecutorOutcome {
  result: ToolExecutionResult;
  session: SessionState;
}

/* Data shapes returned by tools that participate in session updates. */

export interface ConnectWalletData {
  watchAddress: Address;
  walletAddress: Address | null;
  chainId: ChainId;
  chainName: string;
  signerMode: SignerMode | null;
}

export interface ShowWatchTargetData {
  watchAddress: Address | null;
  walletAddress: Address | null;
  chainId: ChainId | null;
  chainName: string | null;
  signerMode: SignerMode | null;
  execution: "read_only" | "wallet_connected";
}

export interface InspectPositionData {
  positionId: string;
  pair: string;
  feeTier: number;
  rangeStatus: "IN_RANGE" | "OUT_OF_RANGE";
  priceLower: number;
  priceUpper: number;
  priceCurrent: number;
  liquidity?: string;
  utilization?: number;
}

export interface RecommendRebalanceData {
  planId: string;
  positionId: string;
  recommended: { kind: string; priceLower: number; priceUpper: number };
  rejected?: { kind: string; priceLower: number; priceUpper: number };
  rejectReason?: string;
  reason: string;
  verdict: string;
  confidence: number;
}

export interface ApplyPlanData {
  planId: string;
  positionId: string;
  signerMode: SignerMode;
  status: "requires_wallet_signature" | "blocked";
  summary: string;
  pair: string;
  feeTier: number;
  oldRange: { priceLower: number; priceUpper: number };
  newRange: { priceLower: number; priceUpper: number };
  residual: { token0: string; token1: string };
  estimatedGas: string;
  estimatedGasUsd: number;
  estimatedSlippage: number;
  verdict: "approve" | "reject" | "approve_with_caution";
  confidence: number;
  reasons: string[];
  warnings: string[];
  approval: {
    kind: "walletconnect_qr";
    status: "requires_project_id" | "requires_session" | "ready";
    uri: string | null;
    instructions: string[];
  };
}

export interface MonitorWalletData {
  walletAddress: Address | null;
  watchAddress: Address | null;
  chainId: ChainId | null;
  intervalMs: number;
  command: string;
  status: "configured" | "needs_address";
}

export interface ShowAlertsData {
  alerts: PositionAlert[];
}
