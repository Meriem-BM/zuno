import { AxlClient } from "@zuno/axl";
import type { AxlEnvelope, InspectRequest, Plan } from "@zuno/core";
import { newRequestId } from "@zuno/core";
import { loadRiskContext, proposeCandidates, recommendPlan } from "@zuno/planner";
import { buildSnapshot, getPosition } from "@zuno/uniswap";
import type { RecommendRebalanceData, ToolDefinition } from "../contracts/types.js";
import {
  err,
  missingReadTarget,
  ok,
  planStore,
  resolvePlanId,
  resolvePositionId,
  resolveReadTarget,
} from "./shared.js";

const recommendRebalance: ToolDefinition = {
  name: "recommendRebalance",
  intents: ["recommend_rebalance"],
  execute: async (intent, ctx) => {
    const positionId = resolvePositionId(intent, ctx);
    if (!positionId) {
      return err("recommendRebalance", "POSITION_NOT_FOUND", "No position id to rebalance.");
    }
    const target = resolveReadTarget(intent, ctx);
    if (!target) return missingReadTarget("recommendRebalance");
    try {
      const axlPlan = await recommendWithAxlIfAvailable(positionId, target.address, target.chainId);
      let plan;
      if (axlPlan) {
        plan = axlPlan;
      } else {
        const snapshot = buildSnapshot(
          await getPosition(positionId, {
            owner: target.address,
            chainId: target.chainId,
          }),
        );
        const riskContext = await loadRiskContext(snapshot);
        plan = recommendPlan(snapshot, riskContext);
      }
      await planStore(ctx).save(plan);
      return ok(
        "recommendRebalance",
        `Stored reviewed plan ${plan.id} for position ${positionId}.`,
        recommendationData(plan),
      );
    } catch (error) {
      return err("recommendRebalance", "CHAIN_READ_FAILED", errorMessage(error));
    }
  },
};

const showRebalanceOptions: ToolDefinition = {
  name: "showRebalanceOptions",
  intents: ["show_rebalance_options"],
  execute: async (intent, ctx) => {
    const positionId = resolvePositionId(intent, ctx);
    if (!positionId) {
      return err(
        "showRebalanceOptions",
        "POSITION_NOT_FOUND",
        "No position id to draft options for.",
      );
    }
    const target = resolveReadTarget(intent, ctx);
    if (!target) return missingReadTarget("showRebalanceOptions");
    try {
      const snapshot = buildSnapshot(
        await getPosition(positionId, {
          owner: target.address,
          chainId: target.chainId,
        }),
      );
      const options = proposeCandidates(snapshot);
      return ok(
        "showRebalanceOptions",
        `Drafted ${options.length} options for position ${positionId}.`,
        {
          positionId,
          options: options.map((candidate) => ({
            kind: candidate.kind,
            priceLower: candidate.priceLower,
            priceUpper: candidate.priceUpper,
          })),
        },
      );
    } catch (error) {
      return err("showRebalanceOptions", "CHAIN_READ_FAILED", errorMessage(error));
    }
  },
};

const explainRecommendation: ToolDefinition = {
  name: "explainRecommendation",
  intents: ["explain_recommendation"],
  execute: async (intent, ctx) => {
    const planId = resolvePlanId(intent, ctx);
    if (!planId) {
      return err("explainRecommendation", "PLAN_NOT_FOUND", "No plan to explain.");
    }
    const plan = await planStore(ctx).get(planId);
    if (!plan)
      return err("explainRecommendation", "PLAN_NOT_FOUND", `Plan ${planId} was not found.`);
    return ok("explainRecommendation", `Rationale for ${planId}.`, {
      planId,
      verdict: plan.risk.verdict,
      confidence: plan.risk.confidence,
      reasons: plan.risk.reasons,
    });
  },
};

export const RECOMMENDATION_TOOLS: readonly ToolDefinition[] = [
  recommendRebalance,
  showRebalanceOptions,
  explainRecommendation,
];

function recommendationData(plan: Plan): RecommendRebalanceData {
  return {
    planId: plan.id,
    positionId: plan.positionId,
    recommended: {
      kind: plan.recommended.kind,
      priceLower: plan.recommended.priceLower,
      priceUpper: plan.recommended.priceUpper,
    },
    rejected: plan.rejected
      ? {
          kind: plan.rejected.kind,
          priceLower: plan.rejected.priceLower,
          priceUpper: plan.rejected.priceUpper,
        }
      : undefined,
    rejectReason: plan.rejectReason,
    reason: plan.recommended.rationale,
    verdict: plan.risk.verdict,
    confidence: plan.risk.confidence,
  };
}

async function recommendWithAxlIfAvailable(
  positionId: string,
  owner: `0x${string}`,
  chainId: 1 | 10 | 8453 | 42161,
): Promise<Plan | null> {
  let client: AxlClient;
  let topology: Awaited<ReturnType<AxlClient["topology"]>>;
  try {
    client = new AxlClient({ role: "cli", pollIntervalMs: 150 });
    topology = await client.topology();
  } catch {
    return null;
  }
  const roles = new Set(topology.peers.map((peer) => peer.role));
  if (!roles.has("watcher") || !roles.has("planner") || !roles.has("risk")) return null;

  await client.register();
  const requestId = newRequestId();
  const env: AxlEnvelope<InspectRequest> = {
    requestId,
    from: "cli",
    to: "watcher",
    kind: "flow_run",
    payload: { positionId, owner, chainId },
    ts: Date.now(),
  };
  await client.send(env);

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const inbox = await client.recv();
    const done = inbox.find(
      (message) => message.requestId === requestId && message.kind === "flow_run:done",
    );
    if (done) return done.payload as Plan;
    const error = inbox.find(
      (message) => message.requestId === requestId && message.kind.endsWith(":error"),
    );
    if (error)
      throw new Error((error.payload as { message?: string }).message ?? "AXL flow failed");
    await sleep(150);
  }
  throw new Error(`AXL recommendation timed out for ${positionId}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
