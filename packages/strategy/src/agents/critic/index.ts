import type {
  AxlEnvelope,
  CreateProposal,
  Critique,
  Deadlock,
  FlowFailed,
  FlowStart,
  Plan,
  PlanCandidate,
  PlanReady,
  PositionSnapshot,
  Proposal,
  RebalanceProposal,
  RiskNote,
} from "@zuno/core";
import { newPlanId } from "@zuno/core";
import { ZERO_ADDRESS } from "@zuno/chain/uniswap";
import { AxlClient } from "../../axl/index.js";
import { makeLogger } from "../shared/log.js";
import { axlThoughtChannel } from "../shared/transcript.js";
import { runCritic, runCriticCreate } from "./handler.js";

const log = makeLogger("critic");
const client = new AxlClient({ role: "critic" });

const MAX_ROUNDS = Number.parseInt(process.env.ZUNO_MAX_DEBATE_ROUNDS ?? "2", 10);

const flows = new Map<
  string,
  {
    history: Array<{ proposal: Proposal; critique: Critique }>;
    riskProfile: FlowStart["riskProfile"];
  }
>();

log(`online  peer=${client.peerId.slice(0, 12)}…  axl=${client.apiUrl}  maxRounds=${MAX_ROUNDS}`);

await client.listen(async (env) => {
  if (env.kind !== "proposal" && env.kind !== "revision") return;
  const { proposal, riskProfile } = env.payload as {
    proposal: Proposal;
    riskProfile?: FlowStart["riskProfile"];
  };
  log(
    `${env.kind}  kind=${proposal.kind}  round=${proposal.round}  candidates=${proposal.candidates.length}`,
  );

  try {
    const channel = axlThoughtChannel(client, env.requestId, "critic");
    const critique =
      proposal.kind === "rebalance"
        ? await runCritic({
            proposal,
            channel,
            riskProfile: riskProfile ?? "balanced",
          })
        : await runCriticCreate({
            proposal,
            channel,
            riskProfile: riskProfile ?? "balanced",
          });

    const slot = flows.get(env.requestId) ?? { history: [], riskProfile };
    slot.history.push({ proposal, critique });
    flows.set(env.requestId, slot);

    if (critique.decision === "accept") {
      const acceptable = critique.judgments.find(
        (j) => j.verdict === "accept" && j.index >= 0 && j.index < proposal.candidates.length,
      );
      if (!acceptable) {
        critique.decision = "revise";
      } else {
        const ready =
          proposal.kind === "rebalance"
            ? buildRebalanceReady(critique)
            : buildCreateReady(critique as Critique & { proposal: CreateProposal });
        flows.delete(env.requestId);
        const planEnv: AxlEnvelope<PlanReady> = {
          requestId: env.requestId,
          from: "critic",
          to: "cli",
          kind: "plan_ready",
          payload: ready,
          ts: Date.now(),
        };
        await client.send(planEnv);
        log(`accept → cli  plan=${ready.plan.id}`);
        return;
      }
    }

    if (slot.history.length >= MAX_ROUNDS) {
      flows.delete(env.requestId);
      const deadlock: Deadlock = {
        history: slot.history,
        reason: critique.rationale,
      };
      const arbEnv: AxlEnvelope<{ deadlock: Deadlock; riskProfile?: FlowStart["riskProfile"] }> = {
        requestId: env.requestId,
        from: "critic",
        to: "arbiter",
        kind: "deadlock",
        payload: { deadlock, riskProfile: slot.riskProfile },
        ts: Date.now(),
      };
      await client.send(arbEnv);
      log(`deadlock → arbiter  rounds=${slot.history.length}`);
      return;
    }

    const revEnv: AxlEnvelope<{ critique: Critique; riskProfile?: FlowStart["riskProfile"] }> = {
      requestId: env.requestId,
      from: "critic",
      to: "strategist",
      kind: "critique",
      payload: { critique, riskProfile: slot.riskProfile },
      ts: Date.now(),
    };
    await client.send(revEnv);
    log(`critique → strategist  round=${proposal.round}  decision=${critique.decision}`);
  } catch (err) {
    flows.delete(env.requestId);
    const failure: FlowFailed = {
      stage: "critic",
      message: err instanceof Error ? err.message : String(err),
    };
    log(`flow_failed  ${failure.message}`);
    await client.send({
      requestId: env.requestId,
      from: "critic",
      to: "cli",
      kind: "flow_failed",
      payload: failure,
      ts: Date.now(),
    });
  }
});

function buildRebalanceReady(critique: Critique): PlanReady {
  if (critique.proposal.kind !== "rebalance") {
    throw new Error("buildRebalanceReady called on non-rebalance critique");
  }
  const proposal = critique.proposal as RebalanceProposal;
  const context = proposal.context;
  const accepted = critique.judgments.find((j) => j.verdict === "accept")!;
  const recommended = proposal.candidates[accepted.index]!;
  const rejected = proposal.candidates.find((_, i) => i !== accepted.index);
  const losingJudgment = critique.judgments.find((j) => j.index !== accepted.index);
  const buffer = accepted.stressBufferHours ?? 0;
  const verdict: RiskNote["verdict"] = buffer >= 36 ? "approve" : "approve_with_caution";
  const confidence = buffer >= 48 ? 0.9 : buffer >= 24 ? 0.78 : 0.62;
  const plan: Plan = {
    id: newPlanId(),
    kind: "rebalance",
    positionId: context.snapshot.position.id,
    createdAt: Date.now(),
    snapshot: context.snapshot,
    recommended,
    rejected,
    rejectReason: losingJudgment?.reason,
    risk: {
      verdict,
      confidence,
      reasons: [
        critique.rationale,
        accepted.reason,
        `regime ${context.regime} · vol ${context.realizedVolBps}bps · gas ${context.gasGwei.toFixed(2)}gwei`,
      ],
    },
  };
  return { plan, decidedBy: "critic", transcript: [] };
}

function buildCreateReady(critique: Critique & { proposal: CreateProposal }): PlanReady {
  const proposal = critique.proposal;
  const accepted = critique.judgments.find((j) => j.verdict === "accept")!;
  const recommended = proposal.candidates[accepted.index]!;
  const losingJudgment = critique.judgments.find((j) => j.index !== accepted.index);
  const surveyed = proposal.context.surveyedPools[recommended.poolIndex]!;
  const pool = surveyed.pool;
  const buffer = accepted.stressBufferHours ?? 0;
  const verdict: RiskNote["verdict"] = buffer >= 36 ? "approve" : "approve_with_caution";
  const confidence = buffer >= 48 ? 0.9 : buffer >= 24 ? 0.78 : 0.62;

  const planCandidate: PlanCandidate = {
    kind: "hold",
    tickLower: recommended.tickLower,
    tickUpper: recommended.tickUpper,
    priceLower: recommended.priceLower,
    priceUpper: recommended.priceUpper,
    deploy0: recommended.amount0,
    deploy1: recommended.amount1,
    residual0: "0",
    residual1: "0",
    required0: recommended.amount0,
    required1: recommended.amount1,
    shortfall0: "0",
    shortfall1: "0",
    slippageBps: 50,
    prepAction: recommended.prepAction,
    rationale: recommended.rationale,
  };

  const snapshot: PositionSnapshot = {
    takenAt: Date.now(),
    range: {
      inRange: true,
      distanceFromBoundary: pool.tickSpacing * 4,
      utilization: 0.5,
      priceLower: recommended.priceLower,
      priceUpper: recommended.priceUpper,
      priceCurrent: pool.price,
    },
    position: {
      id: "create",
      owner: ZERO_ADDRESS,
      tickLower: recommended.tickLower,
      tickUpper: recommended.tickUpper,
      liquidity: "0",
      amount0: recommended.amount0,
      amount1: recommended.amount1,
      feesOwed0: "0",
      feesOwed1: "0",
      pool,
    },
  };

  const plan: Plan = {
    id: newPlanId(),
    kind: "create",
    positionId: `create:${pool.token0.symbol}/${pool.token1.symbol}@${pool.feeTier}`,
    createdAt: Date.now(),
    snapshot,
    recommended: planCandidate,
    rejectReason: losingJudgment?.reason,
    risk: {
      verdict,
      confidence,
      reasons: [
        critique.rationale,
        accepted.reason,
        `regime ${surveyed.regime} · vol ${surveyed.realizedVolBps}bps · gas ${proposal.context.gasGwei.toFixed(2)}gwei`,
      ],
    },
  };
  return { plan, decidedBy: "critic", transcript: [] };
}
export {};
