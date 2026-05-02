import { AxlClient, AGENT_ROLES, peerIdFor } from "@zuno/strategy/axl";
import type {
  AgentThought,
  AxlEnvelope,
  ChainId,
  FlowFailed,
  FlowStart,
  Plan,
  PlanReady,
} from "@zuno/core";
import { newRequestId } from "@zuno/core";
import { agentsAvailable, runDebate } from "@zuno/strategy/agents";
import {
  buildPlanDiff,
  loadRiskContext,
  proposeCandidates,
  recommendPlan,
} from "@zuno/strategy/planner";
import { buildSnapshot, getPosition } from "@zuno/chain/uniswap";
import type { RecommendRebalanceData, ToolDefinition } from "../../contracts/types.js";
import {
  err,
  missingAgentWallet,
  ok,
  planStore,
  resolvePlanId,
  resolvePositionId,
  resolveAgentWallet,
} from "../shared.js";

// Three layers of fallback for recommendRebalance:
//   1. AXL mesh: all four agent peers visible → real four-process debate.
//   2. In-process orchestrator: same four agents, single Node process.
//   3. Deterministic recommendPlan math: no LLM, demo still works.
// The transcript is attached to the saved plan via risk.reasons so
// explainRecommendation can replay the debate.

const recommendRebalance: ToolDefinition = {
  name: "recommendRebalance",
  intents: ["recommend_rebalance"],
  execute: async (intent, ctx) => {
    const positionId = resolvePositionId(intent, ctx);
    if (!positionId) {
      return err("recommendRebalance", "POSITION_NOT_FOUND", "No position id to rebalance.");
    }
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("recommendRebalance");

    try {
      const plan = await produce(positionId, target.address, target.chainId);
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
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("showRebalanceOptions");
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

async function produce(
  positionId: string,
  owner: `0x${string}`,
  chainId: ChainId,
): Promise<Plan> {
  const start: FlowStart = {
    positionId,
    owner,
    chainId,
    riskProfile: (process.env.ZUNO_RISK_PROFILE as FlowStart["riskProfile"]) ?? "balanced",
  };

  // Path 1: real AXL mesh.
  const meshPlan = await tryMesh(start);
  if (meshPlan) return meshPlan;

  // Path 2: in-process LLM debate.
  if (agentsAvailable()) {
    const result = await runDebate({ start });
    return attachTranscript(result.plan, result.ready.transcript);
  }

  // Path 3: deterministic fallback.
  const snapshot = buildSnapshot(await getPosition(positionId, { owner, chainId }));
  const riskContext = await loadRiskContext(snapshot);
  return recommendPlan(snapshot, riskContext);
}

async function tryMesh(start: FlowStart): Promise<Plan | null> {
  let client: AxlClient;
  try {
    client = new AxlClient({ role: "cli", pollIntervalMs: 150 });
    const topology = await client.topology();
    const visible = new Set(topology.peers);
    for (const role of AGENT_ROLES) {
      if (!visible.has(peerIdFor(role))) return null;
    }
  } catch {
    return null;
  }

  const requestId = newRequestId();
  const env: AxlEnvelope<FlowStart> = {
    requestId,
    from: "cli",
    to: "scout",
    kind: "flow_start",
    payload: start,
    ts: Date.now(),
  };
  await client.send(env);

  const transcript: AgentThought[] = [];
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const inbox = await client.recv();
    for (const msg of inbox) {
      if (msg.requestId !== requestId) continue;
      if (msg.kind === "agent_thought") {
        transcript.push(msg.payload as AgentThought);
        continue;
      }
      if (msg.kind === "plan_ready") {
        const ready = msg.payload as PlanReady;
        return attachTranscript(ready.plan, [...transcript, ...(ready.transcript ?? [])]);
      }
      if (msg.kind === "flow_failed") {
        const f = msg.payload as FlowFailed;
        throw new Error(`AXL flow failed at ${f.stage}: ${f.message}`);
      }
    }
    await sleep(150);
  }
  throw new Error(`AXL recommendation timed out for ${start.positionId}`);
}

function attachTranscript(plan: Plan, transcript: AgentThought[]): Plan {
  if (transcript.length === 0) return plan;
  const lines = transcript.map((t) => `[${t.role}] ${t.text}`);
  return {
    ...plan,
    risk: {
      ...plan.risk,
      reasons: [...plan.risk.reasons, ...lines],
    },
  };
}

function recommendationData(plan: Plan): RecommendRebalanceData {
  const transcript = plan.risk.reasons.filter((line) => line.startsWith("["));
  const decidedBy = inferDecidedBy(plan.risk.reasons);
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
    prepAction: plan.recommended.prepAction,
    required: {
      token0: plan.recommended.required0 ?? plan.recommended.deploy0,
      token1: plan.recommended.required1 ?? plan.recommended.deploy1,
    },
    shortfall: {
      token0: plan.recommended.shortfall0 ?? "0",
      token1: plan.recommended.shortfall1 ?? "0",
    },
    slippageBps: plan.recommended.slippageBps,
    reason: plan.recommended.rationale,
    verdict: plan.risk.verdict,
    confidence: plan.risk.confidence,
    transcript: transcript.length > 0 ? transcript : undefined,
    decidedBy,
  };
}

function inferDecidedBy(reasons: readonly string[]): RecommendRebalanceData["decidedBy"] {
  const hasArbiter = reasons.some((r) => r.startsWith("[arbiter]"));
  const hasCritic = reasons.some((r) => r.startsWith("[critic]"));
  if (hasArbiter) return "arbiter";
  if (hasCritic) return "critic";
  return "deterministic";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Re-exported just to keep an existing public surface that other code reads.
export { buildPlanDiff };
