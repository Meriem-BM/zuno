import type {
  ErrorCode,
  ExecutionContext,
  ToolExecutionResult,
  ToolName,
} from "../types.js";

export function ok<T>(tool: ToolName, message: string, data: T): ToolExecutionResult<T> {
  return { tool, status: "success", message, data };
}

export function err(
  tool: ToolName,
  errorCode: ErrorCode,
  message: string,
): ToolExecutionResult {
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
