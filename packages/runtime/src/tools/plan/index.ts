import { prepareApply, simulatePlan as simulateStoredPlan } from "@zuno/execution";
import type { Hex, Plan, PreparedActionRecord } from "@zuno/core";
import { buildPlanDiff } from "@zuno/strategy/planner";
import type {
  ApplyPlanData,
  ApprovePlanData,
  CreatePositionPreparedActionSummary,
  ToolDefinition,
  SwapPreparedActionSummary,
} from "../../contracts/types.js";
import {
  err,
  missingAgentWallet,
  ok,
  planStore,
  preparedActionStore,
  resolveAgentWallet,
  resolveActionId,
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
    const planId = resolveActionId(intent, ctx);
    if (!planId) return err("approvePlan", "PLAN_NOT_FOUND", "No plan to approve.");
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("approvePlan");
    const action = await loadAction(planId, ctx);
    if (!action) return err("approvePlan", "PLAN_NOT_FOUND", `Plan ${planId} was not found.`);

    if (action.kind === "plan") {
      const preview = await prepareApply(action.record, target.address);
      if (preview.status === "blocked") {
        return err(
          "approvePlan",
          preview.policy.allowed ? "EXECUTION_NOT_AVAILABLE" : "POLICY_REJECTED",
          preview.warnings[0] ?? preview.summary,
        );
      }
      return ok("approvePlan", `Approved ${planId}. Turnkey signing is now allowed for this plan.`, {
        kind: "plan",
        planId,
        positionId: action.record.positionId,
        agentWalletAddress: target.address,
        approvalState: "approved",
        executionState: "approved",
        summary: preview.summary,
        warnings: preview.warnings,
      });
    }

    if (action.kind === "create") {
      const summary = action.record.summary;
      return ok(
        "approvePlan",
        `Approved create-position ${planId}. Turnkey signing is now allowed.`,
        {
          kind: "plan",
          planId,
          actionId: planId,
          positionId: planId,
          agentWalletAddress: target.address,
          approvalState: "approved",
          executionState: "approved",
          summary: `mint ${summary.amount0} ${summary.pool.token0.symbol} + ${summary.amount1} ${summary.pool.token1.symbol}`,
          warnings: summary.notes,
          verdict: "approve",
          confidence: 1,
          reasons: ["create-position prepared from agent debate"],
          signer: "turnkey",
        },
      );
    }

    const swapSummary = action.record.summary;
    return ok("approvePlan", `Approved swap ${planId}. Turnkey signing is now allowed.`, {
      kind: "swap",
      planId,
      actionId: planId,
      positionId: planId,
      agentWalletAddress: target.address,
      approvalState: "approved",
      executionState: "approved",
      summary: swapSummary.route,
      warnings: [],
      tokenIn: swapSummary.tokenIn,
      tokenOut: swapSummary.tokenOut,
      amountIn: swapSummary.amountIn,
      amountOut: swapSummary.amountOut,
      minimumOut: swapSummary.minimumOut,
      route: swapSummary.route,
      estimatedGas: swapSummary.estimatedGas,
      estimatedGasUsd: swapSummary.estimatedGasUsd,
      verdict: "approve",
      confidence: 1,
      reasons: ["swap prepared by the Uniswap Trading API"],
      signer: "turnkey",
    });
  },
};

const applyPlan: ToolDefinition<ApplyPlanData> = {
  name: "applyPlan",
  intents: ["apply_plan"],
  execute: async (intent, ctx) => {
    const planId = resolveActionId(intent, ctx);
    if (!planId) return err("applyPlan", "PLAN_NOT_FOUND", "No plan to apply.");
    if (ctx.session.approvalState !== "approved") {
      return err("applyPlan", "APPROVAL_REQUIRED", 'Approve the plan first with "approve it".');
    }

    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("applyPlan");
    const action = await loadAction(planId, ctx);
    if (!action) return err("applyPlan", "PLAN_NOT_FOUND", `Plan ${planId} was not found.`);

    if (action.kind === "plan") {
      const preview = await prepareApply(action.record, target.address, {
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
          kind: "plan",
          planId,
          positionId: action.record.positionId,
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
    }

    if (action.kind === "create") {
      const tx = action.record.transactions[0];
      if (!tx) {
        return err(
          "applyPlan",
          "EXECUTION_NOT_AVAILABLE",
          "No executable mint transaction was prepared.",
        );
      }
      try {
        const signed = await walletService(ctx).signAndSubmit({
          from: tx.from ?? target.address,
          to: tx.to,
          chainId: tx.chainId,
          data: tx.data as Hex,
          value: tx.value,
        });
        const summary = action.record.summary;
        return ok("applyPlan", `Submitted create-position ${planId} through Turnkey.`, {
          kind: "create_position",
          planId,
          actionId: planId,
          positionId: planId,
          agentWalletAddress: target.address,
          approvalState: "approved",
          executionState: "submitted",
          status: "submitted",
          summary: `mint ${summary.amount0} ${summary.pool.token0.symbol} + ${summary.amount1} ${summary.pool.token1.symbol} on ${summary.pool.token0.symbol}/${summary.pool.token1.symbol} ${(summary.pool.feeTier / 10_000).toFixed(2)}%`,
          pair: `${summary.pool.token0.symbol}/${summary.pool.token1.symbol}`,
          feeTier: summary.pool.feeTier,
          oldRange: { priceLower: 0, priceUpper: 0 },
          newRange: { priceLower: summary.priceLower, priceUpper: summary.priceUpper },
          residual: { token0: "0", token1: "0" },
          estimatedGas: "unavailable",
          estimatedGasUsd: 0,
          estimatedSlippage: 0.01,
          verdict: "approve",
          confidence: 1,
          reasons: ["create-position submitted; tokenId visible after confirmation"],
          warnings: summary.notes,
          signer: "turnkey",
          transactionHash: signed.transactionHash,
          turnkeyActivityId: signed.turnkeyActivityId,
        });
      } catch (error) {
        return err("applyPlan", "TURNKEY_SIGNING_FAILED", errorMessage(error));
      }
    }

    try {
      const tx = action.record.transactions[0];
      if (!tx) {
        return err("applyPlan", "EXECUTION_NOT_AVAILABLE", "No executable swap transaction was prepared.");
      }
      const signed = await walletService(ctx).signAndSubmit({
        from: tx.from ?? target.address,
        to: tx.to,
        chainId: tx.chainId,
        data: tx.data as Hex,
        value: tx.value,
      });
      const summary = action.record.summary as SwapPreparedActionSummary;
      return ok("applyPlan", `Submitted ${planId} through the Turnkey-backed Zuno wallet.`, {
        kind: "swap",
        planId,
        actionId: planId,
        positionId: planId,
        agentWalletAddress: target.address,
        approvalState: "approved",
        executionState: "submitted",
        status: "submitted",
        summary: `${summary.amountIn} ${summary.tokenIn.symbol} → ${summary.amountOut} ${summary.tokenOut.symbol}`,
        pair: `${summary.tokenIn.symbol}/${summary.tokenOut.symbol}`,
        feeTier: summary.feeTier ?? 0,
        oldRange: { priceLower: 0, priceUpper: 0 },
        newRange: { priceLower: 0, priceUpper: 0 },
        residual: { token0: "0", token1: "0" },
        estimatedGas: summary.estimatedGas ?? "unavailable",
        estimatedGasUsd: summary.estimatedGasUsd ?? 0,
        estimatedSlippage: 0.005,
        verdict: "approve",
        confidence: 1,
        reasons: ["swap submitted through the Uniswap Trading API"],
        warnings: summary.notes,
        signer: "turnkey",
        tokenIn: summary.tokenIn,
        tokenOut: summary.tokenOut,
        amountIn: summary.amountIn,
        amountOut: summary.amountOut,
        minimumOut: summary.minimumOut,
        route: summary.route,
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

async function loadAction(
  id: string,
  ctx: Parameters<typeof resolveAgentWallet>[0],
): Promise<
  | { kind: "plan"; record: Plan }
  | { kind: "swap"; record: PreparedActionRecord<SwapPreparedActionSummary> }
  | { kind: "create"; record: PreparedActionRecord<CreatePositionPreparedActionSummary> }
  | null
> {
  const plan = await planStore(ctx).get(id);
  if (plan) return { kind: "plan", record: plan };

  const action = await preparedActionStore(ctx).get(id);
  if (!action) return null;
  if (action.kind === "swap") {
    return { kind: "swap", record: action as PreparedActionRecord<SwapPreparedActionSummary> };
  }
  if (action.kind === "lp_create") {
    return {
      kind: "create",
      record: action as PreparedActionRecord<CreatePositionPreparedActionSummary>,
    };
  }
  return null;
}
