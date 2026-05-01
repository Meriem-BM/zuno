import { prepareApply, simulatePlan as simulateStoredPlan } from "@zuno/execution";
import { buildPlanDiff } from "@zuno/strategy/planner";
import type { ApplyPlanData, ApprovePlanData, ToolDefinition } from "../../contracts/types.js";
import {
  err,
  missingAgentWallet,
  ok,
  planStore,
  resolveAgentWallet,
  resolvePlanId,
  walletService,
} from "../shared.js";

const showPlanDiff: ToolDefinition = {
  name: "showPlanDiff",
  intents: ["show_diff"],
  execute: async (intent, ctx) => {
    const planId = resolvePlanId(intent, ctx);
    if (!planId) {
      return err("showPlanDiff", "PLAN_NOT_FOUND", "No plan is available in the current session.");
    }
    const plan = await planStore(ctx).get(planId);
    if (!plan) return err("showPlanDiff", "PLAN_NOT_FOUND", `Plan ${planId} was not found.`);
    const diff = buildPlanDiff(plan);
    return ok("showPlanDiff", `Diff for ${planId}.`, {
      ...diff,
      residual: {
        token0: diff.residual.amount0,
        token1: diff.residual.amount1,
      },
      required: diff.required
        ? {
            token0: diff.required.amount0,
            token1: diff.required.amount1,
          }
        : undefined,
      shortfall: diff.shortfall
        ? {
            token0: diff.shortfall.amount0,
            token1: diff.shortfall.amount1,
          }
        : undefined,
    });
  },
};

const simulatePlan: ToolDefinition = {
  name: "simulatePlan",
  intents: ["simulate_plan"],
  execute: async (intent, ctx) => {
    const planId = resolvePlanId(intent, ctx);
    if (!planId) return err("simulatePlan", "PLAN_NOT_FOUND", "No plan to simulate.");
    const target = resolveAgentWallet(ctx);
    const plan = await planStore(ctx).get(planId);
    if (!plan) return err("simulatePlan", "PLAN_NOT_FOUND", `Plan ${planId} was not found.`);
    const simulation = await simulateStoredPlan(plan, {
      account: target?.address,
      checkChain: ctx.executionReadiness?.checkChain ?? Boolean(target?.address),
    });
    return ok("simulatePlan", `Simulation for ${planId}.`, {
      ...simulation,
      gasEstimate: simulation.estimatedGas ?? "unavailable",
      expectedSlippage: simulation.estimatedSlippage,
      onchainStatus: simulation.onchainStatus,
      success: simulation.canApply,
    });
  },
};

const approvePlan: ToolDefinition<ApprovePlanData> = {
  name: "approvePlan",
  intents: ["approve_plan"],
  execute: async (intent, ctx) => {
    const planId = resolvePlanId(intent, ctx);
    if (!planId) return err("approvePlan", "PLAN_NOT_FOUND", "No plan to approve.");
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("approvePlan");
    const plan = await planStore(ctx).get(planId);
    if (!plan) return err("approvePlan", "PLAN_NOT_FOUND", `Plan ${planId} was not found.`);
    const preview = await prepareApply(plan, target.address);
    if (preview.status === "blocked") {
      return err(
        "approvePlan",
        preview.policy.allowed ? "EXECUTION_NOT_AVAILABLE" : "POLICY_REJECTED",
        preview.warnings[0] ?? preview.summary,
      );
    }
    return ok("approvePlan", `Approved ${planId}. Turnkey signing is now allowed for this plan.`, {
      planId,
      positionId: plan.positionId,
      agentWalletAddress: target.address,
      approvalState: "approved",
      executionState: "approved",
      summary: preview.summary,
      warnings: preview.warnings,
    });
  },
};

const applyPlan: ToolDefinition<ApplyPlanData> = {
  name: "applyPlan",
  intents: ["apply_plan"],
  execute: async (intent, ctx) => {
    const planId = resolvePlanId(intent, ctx);
    if (!planId) return err("applyPlan", "PLAN_NOT_FOUND", "No plan to apply.");
    if (ctx.session.approvalState !== "approved") {
      return err("applyPlan", "APPROVAL_REQUIRED", 'Approve the plan first with "approve it".');
    }

    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("applyPlan");
    const plan = await planStore(ctx).get(planId);
    if (!plan) return err("applyPlan", "PLAN_NOT_FOUND", `Plan ${planId} was not found.`);

    const preview = await prepareApply(plan, target.address, {
      checkAllowances: ctx.executionReadiness?.checkAllowances ?? true,
      checkChain: ctx.executionReadiness?.checkChain ?? true,
    });
    if (preview.status === "blocked" || !preview.transaction) {
      return err(
        "applyPlan",
        preview.policy.allowed ? "EXECUTION_NOT_AVAILABLE" : "POLICY_REJECTED",
        preview.warnings[0] ?? preview.summary,
      );
    }

    try {
      const signed = await walletService(ctx).signAndSubmit(preview.transaction);
      return ok("applyPlan", `Submitted ${planId} through the Turnkey-backed Zuno wallet.`, {
        planId,
        positionId: plan.positionId,
        agentWalletAddress: target.address,
        approvalState: "approved",
        executionState: "submitted",
        status: "submitted",
        summary: preview.summary,
        pair: preview.pair,
        feeTier: preview.feeTier,
        oldRange: preview.oldRange,
        newRange: preview.newRange,
        residual: preview.residual,
        estimatedGas: preview.estimatedGas,
        estimatedGasUnits: preview.estimatedGasUnits,
        estimatedGasUsd: preview.estimatedGasUsd,
        estimatedSlippage: preview.estimatedSlippage,
        onchainStatus: preview.onchainStatus,
        approvalReadiness: preview.approvalReadiness,
        verdict: preview.verdict,
        confidence: preview.confidence,
        reasons: preview.reasons,
        warnings: preview.warnings,
        signer: "turnkey",
        transactionHash: signed.transactionHash,
        turnkeyActivityId: signed.turnkeyActivityId,
      });
    } catch (error) {
      return err("applyPlan", "TURNKEY_SIGNING_FAILED", errorMessage(error));
    }
  },
};

export const PLAN_TOOLS: readonly ToolDefinition[] = [
  showPlanDiff,
  simulatePlan,
  approvePlan,
  applyPlan,
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
