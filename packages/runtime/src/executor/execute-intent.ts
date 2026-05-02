import type { Intent } from "@zuno/strategy/intents";
import { defaultAlertStore, defaultPlanStore, defaultPreparedActionStore } from "@zuno/storage";
import type { ExecutionContext, ExecutorOutcome, ToolExecutionResult } from "../contracts/types.js";
import { NON_ACTIONABLE_INTENTS } from "./constants.js";
import { applyNonSuccessSessionUpdate, applySessionUpdate } from "./helpers.js";

export async function executeIntent(
  intent: Intent,
  context: ExecutionContext,
): Promise<ExecutorOutcome> {
  const ctx: ExecutionContext = {
    ...context,
    planStore: context.planStore ?? defaultPlanStore(),
    alertStore: context.alertStore ?? defaultAlertStore(),
    preparedActionStore: context.preparedActionStore ?? defaultPreparedActionStore(),
  };

  if (NON_ACTIONABLE_INTENTS.has(intent.intent)) {
    return {
      result: {
        tool: "unknown",
        status: "error",
        message: `Intent '${intent.intent}' is handled by the shell, not the executor.`,
        errorCode: "INTENT_NOT_ACTIONABLE",
      },
      session: ctx.session,
    };
  }

  const tool = ctx.tools.find((t) => t.intents.includes(intent.intent));
  if (!tool) {
    return {
      result: {
        tool: "unknown",
        status: "error",
        message: `No tool mapped for intent '${intent.intent}'.`,
        errorCode: "TOOL_NOT_MAPPED",
      },
      session: ctx.session,
    };
  }

  let result: ToolExecutionResult;
  try {
    result = await tool.execute(intent, ctx);
  } catch (e) {
    result = {
      tool: tool.name,
      status: "error",
      message: e instanceof Error ? e.message : String(e),
      errorCode: "TOOL_EXECUTION_FAILED",
    };
  }

  const session =
    result.status === "success" || result.status === "needs_confirmation"
      ? applySessionUpdate(intent, result, context.session)
      : applyNonSuccessSessionUpdate(intent, ctx.session);

  return { result, session };
}
