import type {
  AxlEnvelope,
  CreateContext,
  CreateProposal,
  Critique,
  FlowFailed,
  FlowStart,
  MarketContext,
  Proposal,
  RebalanceProposal,
} from "@zuno/core";
import { AxlClient } from "../../axl/index.js";
import { makeLogger } from "../shared/log.js";
import { axlThoughtChannel } from "../shared/transcript.js";
import { runStrategist, runStrategistCreate } from "./handler.js";

const log = makeLogger("strategist");
const client = new AxlClient({ role: "strategist" });

log(`online  peer=${client.peerId.slice(0, 12)}…  axl=${client.apiUrl}`);

interface RebalanceContextEnvelope extends MarketContext {
  riskProfile?: FlowStart["riskProfile"];
}
interface CreateContextEnvelope extends CreateContext {
  riskProfile?: FlowStart["riskProfile"];
}

await client.listen(async (env) => {
  if (env.kind === "context_observed") {
    const payload = env.payload as RebalanceContextEnvelope | CreateContextEnvelope;
    if (isCreateContext(payload)) {
      log(`context_observed (create)  pools=${payload.surveyedPools.length}`);
      await proposeCreate(env.requestId, payload, 0);
    } else {
      log(`context_observed  regime=${payload.regime}`);
      await proposeRebalance(env.requestId, payload, 0);
    }
    return;
  }
  if (env.kind === "critique") {
    const { critique, riskProfile } = env.payload as {
      critique: Critique;
      riskProfile?: FlowStart["riskProfile"];
    };
    if (critique.decision !== "revise") return;
    const round = critique.proposal.round + 1;
    log(`critique  round=${round}  decision=${critique.decision}  kind=${critique.proposal.kind}`);
    if (critique.proposal.kind === "rebalance") {
      await proposeRebalance(
        env.requestId,
        { ...critique.proposal.context, riskProfile },
        round,
        critique.proposal,
        critique,
      );
    } else {
      await proposeCreate(
        env.requestId,
        { ...critique.proposal.context, riskProfile },
        round,
        critique.proposal,
        critique,
      );
    }
  }
});

function isCreateContext(p: unknown): p is CreateContextEnvelope {
  return Boolean(p && typeof p === "object" && "surveyedPools" in p);
}

async function proposeRebalance(
  requestId: string,
  context: RebalanceContextEnvelope,
  round: number,
  priorProposal?: RebalanceProposal,
  priorCritique?: Critique,
): Promise<void> {
  try {
    const channel = axlThoughtChannel(client, requestId, "strategist");
    const proposal = await runStrategist({
      context,
      channel,
      round,
      priorCritique,
      priorProposal,
    });
    await sendProposal(requestId, round, proposal, context.riskProfile);
    log(`forwarded → critic  round=${round}  candidates=${proposal.candidates.length}`);
  } catch (err) {
    await failFlow(requestId, err);
  }
}

async function proposeCreate(
  requestId: string,
  context: CreateContextEnvelope,
  round: number,
  priorProposal?: CreateProposal,
  priorCritique?: Critique,
): Promise<void> {
  try {
    const channel = axlThoughtChannel(client, requestId, "strategist");
    const proposal = await runStrategistCreate({
      context,
      channel,
      round,
      priorCritique,
      priorProposal,
    });
    await sendProposal(requestId, round, proposal, context.riskProfile);
    log(
      `forwarded → critic (create)  round=${round}  candidates=${proposal.candidates.length}`,
    );
  } catch (err) {
    await failFlow(requestId, err);
  }
}

async function sendProposal(
  requestId: string,
  round: number,
  proposal: Proposal,
  riskProfile?: FlowStart["riskProfile"],
): Promise<void> {
  const env: AxlEnvelope<{ proposal: Proposal; riskProfile?: FlowStart["riskProfile"] }> = {
    requestId,
    from: "strategist",
    to: "critic",
    kind: round === 0 ? "proposal" : "revision",
    payload: { proposal, riskProfile },
    ts: Date.now(),
  };
  await client.send(env);
}

async function failFlow(requestId: string, err: unknown): Promise<void> {
  const failure: FlowFailed = {
    stage: "strategist",
    message: err instanceof Error ? err.message : String(err),
  };
  log(`flow_failed  ${failure.message}`);
  await client.send({
    requestId,
    from: "strategist",
    to: "cli",
    kind: "flow_failed",
    payload: failure,
    ts: Date.now(),
  });
}
export {};
