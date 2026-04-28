import type { RecommendRebalanceData, ToolDefinition } from "../types.js";
import { err, ok, resolvePlanId, resolvePositionId } from "./shared.js";

function nextPlanId(): string {
  return `plan_${Math.random().toString(16).slice(2, 14)}`;
}

function buildPlan(positionId: string): RecommendRebalanceData {
  return {
    planId: nextPlanId(),
    positionId,
    recommended: { kind: "shift", priceLower: 2273.36, priceUpper: 2614.97 },
    rejected: { kind: "tighten", priceLower: 2361.41, priceUpper: 2519.99 },
    rejectReason: "less than 36h of buffer at recent volatility",
    reason: "Recenter on current tick with ~40% wider range.",
  };
}

const recommendRebalance: ToolDefinition = {
  name: "recommendRebalance",
  intents: ["recommend_rebalance"],
  execute: (intent, ctx) => {
    const positionId = resolvePositionId(intent, ctx);
    if (!positionId) {
      return err("recommendRebalance", "POSITION_NOT_FOUND", "No position id to rebalance.");
    }
    const plan = buildPlan(positionId);
    return ok("recommendRebalance", `Drafted plan ${plan.planId} for position ${positionId}.`, plan);
  },
};

const showRebalanceOptions: ToolDefinition = {
  name: "showRebalanceOptions",
  intents: ["show_rebalance_options"],
  execute: (intent, ctx) => {
    const positionId = resolvePositionId(intent, ctx);
    if (!positionId) {
      return err("showRebalanceOptions", "POSITION_NOT_FOUND", "No position id to draft options for.");
    }
    return ok("showRebalanceOptions", `Drafted 2 options for position ${positionId}.`, {
      positionId,
      options: [
        { kind: "shift", priceLower: 2273.36, priceUpper: 2614.97 },
        { kind: "tighten", priceLower: 2361.41, priceUpper: 2519.99 },
      ],
    });
  },
};

const explainRecommendation: ToolDefinition = {
  name: "explainRecommendation",
  intents: ["explain_recommendation"],
  execute: (intent, ctx) => {
    const planId = resolvePlanId(intent, ctx);
    if (!planId) {
      return err("explainRecommendation", "PLAN_NOT_FOUND", "No plan to explain.");
    }
    return ok("explainRecommendation", `Rationale for ${planId}.`, {
      planId,
      verdict: "approve_with_caution",
      confidence: 0.82,
      reasons: [
        "position was out of range, repositioning incurs swap cost",
        "wider band gives ~36h buffer at recent volatility",
      ],
    });
  },
};

export const RECOMMENDATION_TOOLS: readonly ToolDefinition[] = [
  recommendRebalance,
  showRebalanceOptions,
  explainRecommendation,
];
