import type { SessionState } from "@zuno/core";
import type { Intent, IntentKind } from "@zuno/intents";
import { defaultAlertStore, defaultPlanStore } from "@zuno/storage";
import type {
  ConnectWalletData,
  ExecutionContext,
  ExecutorOutcome,
  RecommendRebalanceData,
  ShowWatchTargetData,
  ToolExecutionResult,
} from "../contracts/types.js";

const NON_ACTIONABLE: ReadonlySet<IntentKind> = new Set<IntentKind>([
  "exit",
  "help",
  "unknown",
  "needs_clarification",
]);

export async function executeIntent(
  intent: Intent,
  context: ExecutionContext,
): Promise<ExecutorOutcome> {
  const executionContext: ExecutionContext = {
    ...context,
    planStore: context.planStore ?? defaultPlanStore(),
    alertStore: context.alertStore ?? defaultAlertStore(),
  };
  if (NON_ACTIONABLE.has(intent.intent)) {
    return {
      result: {
        tool: "unknown",
        status: "error",
        message: `Intent '${intent.intent}' is handled by the shell, not the executor.`,
        errorCode: "INTENT_NOT_ACTIONABLE",
      },
      session: executionContext.session,
    };
  }

  const tool = executionContext.tools.find((t) => t.intents.includes(intent.intent));
  if (!tool) {
    return {
      result: {
        tool: "unknown",
        status: "error",
        message: `No tool mapped for intent '${intent.intent}'.`,
        errorCode: "TOOL_NOT_MAPPED",
      },
      session: executionContext.session,
    };
  }

  let result: ToolExecutionResult;
  try {
    result = await tool.execute(intent, executionContext);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    result = {
      tool: tool.name,
      status: "error",
      message,
      errorCode: "TOOL_EXECUTION_FAILED",
    };
  }

  const session =
    result.status === "success"
      ? applySessionUpdate(intent, result, context.session)
      : applyNonSuccessSessionUpdate(intent, executionContext.session);

  return { result, session };
}

function applyNonSuccessSessionUpdate(intent: Intent, session: SessionState): SessionState {
  if (!intent.walletAddress) return session;
  return {
    ...session,
    watchAddress: intent.walletAddress as SessionState["watchAddress"],
    lastIntent: intent.intent,
  };
}

function applySessionUpdate(
  intent: Intent,
  result: ToolExecutionResult,
  session: SessionState,
): SessionState {
  const patch: Partial<SessionState> = { lastIntent: intent.intent };

  if (intent.positionId) patch.lastPositionId = intent.positionId;
  if (intent.planId) patch.lastPlanId = intent.planId;
  if (intent.walletAddress)
    patch.watchAddress = intent.walletAddress as SessionState["watchAddress"];
  if (intent.signerMode) patch.signerMode = intent.signerMode;

  if (result.tool === "connectWallet" && isConnectWalletData(result.data)) {
    patch.watchAddress = result.data.watchAddress;
    if (result.data.walletAddress) patch.walletAddress = result.data.walletAddress;
    patch.chainId = result.data.chainId;
    if (result.data.signerMode) patch.signerMode = result.data.signerMode;
  }

  if (isReadTargetData(result.data)) {
    patch.watchAddress = result.data.watchAddress;
    patch.chainId = result.data.chainId;
  }

  if (result.tool === "recommendRebalance" && isRecommendRebalanceData(result.data)) {
    patch.lastPlanId = result.data.planId;
  }

  return { ...session, ...patch };
}

function isConnectWalletData(data: unknown): data is ConnectWalletData {
  return typeof data === "object" && data !== null && "watchAddress" in data && "chainId" in data;
}

function isReadTargetData(
  data: unknown,
): data is Pick<ShowWatchTargetData, "watchAddress" | "chainId"> {
  return (
    typeof data === "object" &&
    data !== null &&
    "watchAddress" in data &&
    "chainId" in data &&
    (data as { watchAddress?: unknown }).watchAddress !== null &&
    (data as { chainId?: unknown }).chainId !== null
  );
}

function isRecommendRebalanceData(data: unknown): data is RecommendRebalanceData {
  return typeof data === "object" && data !== null && "planId" in data;
}
