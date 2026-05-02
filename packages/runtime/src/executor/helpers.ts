import type { SessionState } from "@zuno/core";
import type { Intent } from "@zuno/strategy/intents";
import type {
  AgentWalletData,
  ApplyPlanData,
  ApprovePlanData,
  RecommendRebalanceData,
  SwitchNetworkData,
  ToolExecutionResult,
} from "../contracts/types.js";

export function applySessionUpdate(
  intent: Intent,
  result: ToolExecutionResult,
  session: SessionState,
): SessionState {
  const patch: Partial<SessionState> = { lastIntent: intent.intent };

  if (intent.positionId) patch.lastPositionId = intent.positionId;
  if (intent.planId) patch.lastPlanId = intent.planId;

  if (
    (result.tool === "createAgentWallet" || result.tool === "showAgentWallet") &&
    isAgentWalletData(result.data)
  ) {
    patch.agentWalletAddress = result.data.agentWalletAddress;
    if (result.data.userWalletAddress) patch.userWalletAddress = result.data.userWalletAddress;
    patch.chainId = result.data.chainId;
  }

  if (result.tool === "recommendRebalance" && isRecommendRebalanceData(result.data)) {
    patch.lastPlanId = result.data.planId;
    patch.lastActionId = result.data.planId;
    patch.approvalState = "idle";
    patch.executionState = "drafted";
  }

  if (hasPreparedAction(result.data)) {
    if (result.data.preparedAction.kind !== "approve") {
      patch.lastActionId = result.data.preparedAction.id;
    }
  }

  if (result.tool === "simulatePlan") {
    patch.executionState = "simulated";
  }

  if (result.tool === "approvePlan" && isApprovePlanData(result.data)) {
    patch.lastPlanId = result.data.planId;
    patch.lastPositionId = result.data.positionId;
    patch.agentWalletAddress = result.data.agentWalletAddress;
    patch.approvalState = result.data.approvalState;
    patch.executionState = result.data.executionState;
  }

  if (result.tool === "applyPlan" && isApplyPlanData(result.data)) {
    patch.lastPlanId = result.data.planId;
    patch.lastPositionId = result.data.positionId;
    patch.agentWalletAddress = result.data.agentWalletAddress;
    patch.approvalState = result.data.approvalState;
    patch.executionState = result.data.executionState;
  }

  if (result.tool === "switchNetwork" && isSwitchNetworkData(result.data)) {
    patch.chainId = result.data.chainId;
  }

  return { ...session, ...patch };
}

export function applyNonSuccessSessionUpdate(intent: Intent, session: SessionState): SessionState {
  const patch: Partial<SessionState> = { lastIntent: intent.intent };
  if (intent.intent === "apply_plan" && session.approvalState === "approved") {
    patch.executionState = "failed";
  }
  return { ...session, ...patch };
}

function isAgentWalletData(data: unknown): data is AgentWalletData {
  return (
    typeof data === "object" && data !== null && "agentWalletAddress" in data && "chainId" in data
  );
}

function isRecommendRebalanceData(data: unknown): data is RecommendRebalanceData {
  return typeof data === "object" && data !== null && "planId" in data;
}

function isApprovePlanData(data: unknown): data is ApprovePlanData {
  return typeof data === "object" && data !== null && "approvalState" in data;
}

function isApplyPlanData(data: unknown): data is ApplyPlanData {
  return typeof data === "object" && data !== null && "executionState" in data;
}

function isSwitchNetworkData(data: unknown): data is SwitchNetworkData {
  return (
    typeof data === "object" && data !== null && "chainId" in data && "previousChainId" in data
  );
}

function hasPreparedAction(
  data: unknown,
): data is { preparedAction: { id: string; kind: string } } {
  return (
    typeof data === "object" &&
    data !== null &&
    "preparedAction" in data &&
    typeof (data as { preparedAction?: { id?: unknown } }).preparedAction?.id === "string"
  );
}
