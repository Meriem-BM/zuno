import type { SessionState } from "@zuno/core";
import type { Intent, IntentKind } from "@zuno/intents";
import type {
  ConnectWalletData,
  ExecutionContext,
  ExecutorOutcome,
  RecommendRebalanceData,
  ToolExecutionResult,
} from "./types.js";

const NON_ACTIONABLE: ReadonlySet<IntentKind> = new Set<IntentKind>([
  "exit",
  "help",
  "unknown",
  "needs_clarification",
]);

/**
 * Pipeline: validate intent is actionable → look up tool → execute →
 * structure errors → centralize session updates on success.
 */
export async function executeIntent(
  intent: Intent,
  context: ExecutionContext,
): Promise<ExecutorOutcome> {
  if (NON_ACTIONABLE.has(intent.intent)) {
    return {
      result: {
        tool: "unknown",
        status: "error",
        message: `Intent '${intent.intent}' is handled by the shell, not the executor.`,
        errorCode: "INTENT_NOT_ACTIONABLE",
      },
      session: context.session,
    };
  }

  const tool = context.tools.find((t) => t.intents.includes(intent.intent));
  if (!tool) {
    return {
      result: {
        tool: "unknown",
        status: "error",
        message: `No tool mapped for intent '${intent.intent}'.`,
        errorCode: "TOOL_NOT_MAPPED",
      },
      session: context.session,
    };
  }

  let result: ToolExecutionResult;
  try {
    result = await tool.execute(intent, context);
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
      : context.session;

  return { result, session };
}

/**
 * Single source of truth for session writes. Always sets `lastIntent`. Tools
 * that produce a wallet connection or a new plan have their data folded back
 * into the session here, never inside the tool itself.
 */
function applySessionUpdate(
  intent: Intent,
  result: ToolExecutionResult,
  session: SessionState,
): SessionState {
  const patch: Partial<SessionState> = { lastIntent: intent.intent };

  if (intent.positionId) patch.lastPositionId = intent.positionId;
  if (intent.planId) patch.lastPlanId = intent.planId;
  if (intent.signerMode) patch.signerMode = intent.signerMode;

  if (result.tool === "connectWallet" && isConnectWalletData(result.data)) {
    patch.walletAddress = result.data.walletAddress;
    patch.chainId = result.data.chainId;
    patch.signerMode = result.data.signerMode;
  }

  if (result.tool === "recommendRebalance" && isRecommendRebalanceData(result.data)) {
    patch.lastPlanId = result.data.planId;
  }

  return { ...session, ...patch };
}

function isConnectWalletData(data: unknown): data is ConnectWalletData {
  return (
    typeof data === "object"
    && data !== null
    && "walletAddress" in data
    && "chainId" in data
    && "signerMode" in data
  );
}

function isRecommendRebalanceData(data: unknown): data is RecommendRebalanceData {
  return typeof data === "object" && data !== null && "planId" in data;
}
