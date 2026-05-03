import type {
  Address,
  AgentThought,
  ApprovalState,
  ChainId,
  ExecutionState,
  Hex,
  PreparedActionKind,
  PreparedActionTransaction,
  SessionState,
} from "@zuno/core";
import type { PositionAlert } from "@zuno/core";
import type { Intent, IntentKind } from "@zuno/strategy/intents";
import type { AlertStore, PlanStore, PreparedActionStore } from "@zuno/storage";
import type { AgentWalletService } from "@zuno/chain/wallet";

export type ToolName =
  | "createAgentWallet"
  | "showAgentWallet"
  | "showAgentWalletBalance"
  | "showBalances"
  | "showNetwork"
  | "switchNetwork"
  | "showAllowances"
  | "fundAgentWallet"
  | "createPosition"
  | "swapTokens"
  | "prepareSwap"
  | "showQuote"
  | "approveToken"
  | "approvePermit2Spender"
  | "listAgentWalletPositions"
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
  | "approvePlan"
  | "applyPlan"
  | "showAgentStatus"
  | "showPeers"
  | "showLogs"
  | "refreshPools"
  | "monitorWallet"
  | "showAlerts";

export type ToolExecutionStatus = "success" | "error" | "needs_confirmation";

export interface PreparedAction<TSummary = unknown> {
  id: string;
  kind: PreparedActionKind;
  summary: TSummary;
  transactions: PreparedActionTransaction[];
  expiresAt: number;
}

export interface NeedsConfirmationData<TSummary = unknown> {
  preparedAction: PreparedAction<TSummary>;
  prompt: string;
}

export type ErrorCode =
  | "POSITION_NOT_FOUND"
  | "PLAN_NOT_FOUND"
  | "WALLET_AUTH_FAILED"
  | "CHAIN_READ_FAILED"
  | "CHAIN_UNSUPPORTED"
  | "TOKEN_UNKNOWN"
  | "APPROVAL_REQUIRED"
  | "AGENT_WALLET_NOT_FOUND"
  | "POLICY_REJECTED"
  | "TURNKEY_SIGNING_FAILED"
  | "EXECUTION_NOT_AVAILABLE"
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
  preparedActionStore?: PreparedActionStore;
  walletService?: AgentWalletService;
  executionReadiness?: {
    checkChain?: boolean;
    checkAllowances?: boolean;
  };
  onAgentThought?: (thought: AgentThought) => void;
}

export interface ExecutorOutcome {
  result: ToolExecutionResult;
  session: SessionState;
}

export interface AgentWalletData {
  agentWalletAddress: Address;
  userWalletAddress: Address | null;
  chainId: ChainId;
  chainName: string;
  provider: "turnkey";
  status: string;
  walletId?: string;
}

export interface AgentWalletBalanceData {
  agentWalletAddress: Address;
  chainId: ChainId | null;
  chainName: string | null;
  native: { symbol: string; amount: string };
  funded: boolean;
}

export interface FundAgentWalletData {
  agentWalletAddress: Address | null;
  userWalletAddress: Address | null;
  chainId: ChainId | null;
  status: "ready" | "needs_agent_wallet";
  instructions: string[];
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
  prepAction?: string;
  shortfall?: { token0: string; token1: string };
  required?: { token0: string; token1: string };
  slippageBps?: number;
  reason: string;
  verdict: string;
  confidence: number;
  transcript?: string[];
  decidedBy?: "critic" | "arbiter" | "deterministic";
}

export interface ApplyPlanData {
  kind: "plan" | "swap" | "create_position" | "approve";
  planId: string;
  positionId: string;
  agentWalletAddress: Address;
  approvalState: ApprovalState;
  executionState: ExecutionState;
  status: "submitted" | "blocked" | "signing";
  summary: string;
  pair: string;
  feeTier: number;
  oldRange: { priceLower: number; priceUpper: number };
  newRange: { priceLower: number; priceUpper: number };
  residual: { token0: string; token1: string };
  estimatedGas: string;
  estimatedGasUnits?: string;
  estimatedGasUsd: number;
  estimatedSlippage: number;
  onchainStatus?: "not_checked" | "passed" | "failed";
  approvalReadiness?: {
    tokenSymbol: string;
    requiredWei: string;
    currentAllowanceWei?: string;
    sufficient: boolean;
    reason?: string;
  }[];
  verdict: "approve" | "reject" | "approve_with_caution";
  confidence: number;
  reasons: string[];
  warnings: string[];
  signer: "turnkey";
  transactionHash?: Hex;
  turnkeyActivityId?: string;
  tokenIn?: { symbol: string; address: Address; decimals: number };
  tokenOut?: { symbol: string; address: Address; decimals: number };
  amountIn?: string;
  amountOut?: string;
  minimumOut?: string;
  route?: string;
  tokenSymbol?: string;
  tokenAmount?: string;
  spenderLabel?: string;
  spenderAddress?: Address;
}

export interface ApprovePlanData {
  kind: "plan" | "swap" | "approve";
  planId: string;
  positionId: string;
  agentWalletAddress: Address;
  approvalState: ApprovalState;
  executionState: ExecutionState;
  summary: string;
  warnings: string[];
  actionId?: string;
  tokenIn?: { symbol: string; address: Address; decimals: number };
  tokenOut?: { symbol: string; address: Address; decimals: number };
  amountIn?: string;
  amountOut?: string;
  minimumOut?: string;
  route?: string;
  estimatedGas?: string;
  estimatedGasUsd?: number;
  verdict?: "approve" | "reject" | "approve_with_caution";
  confidence?: number;
  reasons?: string[];
  signer?: "turnkey";
  transactionHash?: Hex;
  turnkeyActivityId?: string;
  tokenSymbol?: string;
  tokenAmount?: string;
  spenderLabel?: string;
  spenderAddress?: Address;
}

export interface CreatePositionPreparedActionSummary {
  kind: "create_position";
  chainId: ChainId;
  chainName: string;
  pool: {
    address: Address;
    token0: { symbol: string; address: Address; decimals: number };
    token1: { symbol: string; address: Address; decimals: number };
    feeTier: number;
    tickSpacing: number;
  };
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  priceCurrent: number;
  inRange: boolean;
  rangeStatus: string;
  amount0: string;
  amount1: string;
  expectedYield24hUsd: number;
  prepAction?: string;
  goalSummary: string;
  poolReason?: string;
  riskProfile: "conservative" | "balanced" | "aggressive";
  amount0Max: string;
  amount1Max: string;
  slippageBps: number;
  notes: string[];
}

export interface SwapPreparedActionSummary {
  kind: "swap";
  chainId: ChainId;
  chainName: string;
  tokenIn: { symbol: string; address: Address; decimals: number };
  tokenOut: { symbol: string; address: Address; decimals: number };
  amountIn: string;
  amountOut: string;
  minimumOut: string;
  route: string;
  feeTier?: number;
  price?: number;
  source: "uniswap_trading_api" | "uniswap_v4";
  quoteId?: string;
  requestId?: string;
  estimatedGas?: string;
  estimatedGasUsd?: number;
  notes: string[];
}

export interface MonitorWalletData {
  userWalletAddress: Address | null;
  agentWalletAddress: Address | null;
  chainId: ChainId | null;
  intervalMs: number;
  command: string;
  status: "configured" | "needs_address";
}

export interface ShowAlertsData {
  alerts: PositionAlert[];
}

export interface ShowBalancesData {
  agentWalletAddress: Address;
  chainId: ChainId;
  chainName: string;
  native: { symbol: string; amount: string };
  tokens: { symbol: string; amount: string; address: Address; decimals: number }[];
}

export interface ShowNetworkData {
  chainId: ChainId;
  chainName: string;
  nativeSymbol: string;
  rpcConfigured: boolean;
  supported: { chainId: ChainId; name: string }[];
}

export interface SwitchNetworkData {
  previousChainId: ChainId;
  chainId: ChainId;
  chainName: string;
}

export interface ShowAllowancesData {
  agentWalletAddress: Address;
  chainId: ChainId;
  chainName: string;
  spender: Address;
  spenderLabel: string;
  allowances: {
    token: { address: Address; symbol: string; decimals: number };
    allowance: string;
    sufficient?: boolean;
  }[];
}

export interface ApproveTokenSummary {
  tokenSymbol: string;
  tokenAddress: Address;
  spenderLabel: string;
  spenderAddress: Address;
  amount: string;
  chainId: ChainId;
  chainName: string;
}

export interface SwapQuoteData {
  chainId: ChainId;
  chainName: string;
  tokenIn: { symbol: string; address: Address; decimals: number };
  tokenOut: { symbol: string; address: Address; decimals: number };
  amountIn: string;
  amountOut: string;
  feeTier: number;
  price: number;
  route: string;
  minimumOut: string;
  notes: string[];
  source: "uniswap_trading_api" | "uniswap_v4";
}
