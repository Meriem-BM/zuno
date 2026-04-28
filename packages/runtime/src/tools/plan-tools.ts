import type { ToolDefinition } from "../types.js";
import { err, ok, resolvePlanId } from "./shared.js";

function nextTxHash(): string {
  return `0x${Math.random().toString(16).slice(2, 10).padEnd(64, "0")}`;
}

const showPlanDiff: ToolDefinition = {
  name: "showPlanDiff",
  intents: ["show_diff"],
  execute: (intent, ctx) => {
    const planId = resolvePlanId(intent, ctx);
    if (!planId) {
      return err("showPlanDiff", "PLAN_NOT_FOUND", "No plan is available in the current session.");
    }
    return ok("showPlanDiff", `Diff for ${planId}.`, {
      planId,
      oldRange: { priceLower: 2190.79, priceUpper: 2421.19 },
      newRange: { priceLower: 2273.36, priceUpper: 2614.97 },
      residual: { token0: "0.012", token1: "23.4" },
    });
  },
};

const simulatePlan: ToolDefinition = {
  name: "simulatePlan",
  intents: ["simulate_plan"],
  execute: (intent, ctx) => {
    const planId = resolvePlanId(intent, ctx);
    if (!planId) {
      return err("simulatePlan", "PLAN_NOT_FOUND", "No plan to simulate.");
    }
    return ok("simulatePlan", `Simulation for ${planId}.`, {
      planId,
      gasEstimate: "0.0042 ETH",
      expectedSlippage: 0.0023,
      success: true,
    });
  },
};

const applyPlan: ToolDefinition = {
  name: "applyPlan",
  intents: ["apply_plan"],
  execute: (intent, ctx) => {
    const planId = resolvePlanId(intent, ctx);
    if (!planId) {
      return err("applyPlan", "PLAN_NOT_FOUND", "No plan to apply.");
    }
    const signerMode = intent.signerMode ?? ctx.session.signerMode;
    if (!signerMode) {
      return err("applyPlan", "SIGNER_NOT_SPECIFIED", "Specify wallet or enclave to sign with.");
    }
    return ok("applyPlan", `Submitted ${planId}.`, {
      planId,
      txHash: nextTxHash(),
      signerMode,
      status: "submitted",
    });
  },
};

export const PLAN_TOOLS: readonly ToolDefinition[] = [
  showPlanDiff,
  simulatePlan,
  applyPlan,
];
