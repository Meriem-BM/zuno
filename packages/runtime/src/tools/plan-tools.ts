import { prepareApply, simulatePlan as simulateStoredPlan } from "@zuno/execution";
import { buildPlanDiff } from "@zuno/planner";
import type { ToolDefinition } from "../contracts/types.js";
import { err, ok, planStore, resolvePlanId } from "./shared.js";

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
    });
  },
};

const simulatePlan: ToolDefinition = {
  name: "simulatePlan",
  intents: ["simulate_plan"],
  execute: async (intent, ctx) => {
    const planId = resolvePlanId(intent, ctx);
    if (!planId) {
      return err("simulatePlan", "PLAN_NOT_FOUND", "No plan to simulate.");
    }
    const plan = await planStore(ctx).get(planId);
    if (!plan) return err("simulatePlan", "PLAN_NOT_FOUND", `Plan ${planId} was not found.`);
    const simulation = simulateStoredPlan(plan);
    return ok("simulatePlan", `Simulation for ${planId}.`, {
      ...simulation,
      gasEstimate: simulation.estimatedGas ?? "unavailable",
      expectedSlippage: 0,
      success: simulation.canApply,
    });
  },
};

const applyPlan: ToolDefinition = {
  name: "applyPlan",
  intents: ["apply_plan"],
  execute: async (intent, ctx) => {
    const planId = resolvePlanId(intent, ctx);
    if (!planId) {
      return err("applyPlan", "PLAN_NOT_FOUND", "No plan to apply.");
    }
    const signerMode = intent.signerMode ?? "wallet";
    const plan = await planStore(ctx).get(planId);
    if (!plan) return err("applyPlan", "PLAN_NOT_FOUND", `Plan ${planId} was not found.`);
    const preview = prepareApply(plan, signerMode);
    if (preview.status === "blocked") {
      return err("applyPlan", "EXECUTION_NOT_AVAILABLE", preview.summary);
    }
    return ok("applyPlan", `Prepared ${planId}; QR wallet approval is required.`, preview);
  },
};

export const PLAN_TOOLS: readonly ToolDefinition[] = [showPlanDiff, simulatePlan, applyPlan];
