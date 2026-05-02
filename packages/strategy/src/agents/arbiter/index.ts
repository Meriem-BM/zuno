import type {
  AxlEnvelope,
  Deadlock,
  FlowFailed,
  FlowStart,
  PlanReady,
} from "@zuno/core";
import { AxlClient } from "../../axl/index.js";
import { makeLogger } from "../shared/log.js";
import { axlThoughtChannel } from "../shared/transcript.js";
import { runArbiter, runArbiterCreate } from "./handler.js";

const log = makeLogger("arbiter");
const client = new AxlClient({ role: "arbiter" });

log(`online  peer=${client.peerId.slice(0, 12)}…  axl=${client.apiUrl}`);

await client.listen(async (env) => {
  if (env.kind !== "deadlock") return;
  const { deadlock, riskProfile } = env.payload as {
    deadlock: Deadlock;
    riskProfile?: FlowStart["riskProfile"];
  };
  log(`deadlock  rounds=${deadlock.history.length}  reason=${deadlock.reason}`);

  try {
    const channel = axlThoughtChannel(client, env.requestId, "arbiter");
    const firstKind = deadlock.history[0]?.proposal.kind ?? "rebalance";

    let ready: PlanReady;
    if (firstKind === "rebalance") {
      const rebalanceHistory = deadlock.history.flatMap((entry) =>
        entry.proposal.kind === "rebalance"
          ? [{ proposal: entry.proposal, critique: entry.critique }]
          : [],
      );
      const decision = await runArbiter({
        history: rebalanceHistory,
        channel,
        riskProfile: riskProfile ?? "balanced",
        transcript: [],
      });
      ready = decision.ready;
    } else {
      const createHistory = deadlock.history.flatMap((entry) =>
        entry.proposal.kind === "create"
          ? [{ proposal: entry.proposal, critique: entry.critique }]
          : [],
      );
      const decision = await runArbiterCreate({
        history: createHistory,
        channel,
        riskProfile: riskProfile ?? "balanced",
        transcript: [],
      });
      ready = decision.ready;
    }

    const out: AxlEnvelope<PlanReady> = {
      requestId: env.requestId,
      from: "arbiter",
      to: "cli",
      kind: "plan_ready",
      payload: ready,
      ts: Date.now(),
    };
    await client.send(out);
    log(`plan_ready → cli  plan=${ready.plan.id}  decidedBy=arbiter  kind=${ready.plan.kind ?? "rebalance"}`);
  } catch (err) {
    const failure: FlowFailed = {
      stage: "arbiter",
      message: err instanceof Error ? err.message : String(err),
    };
    log(`flow_failed  ${failure.message}`);
    await client.send({
      requestId: env.requestId,
      from: "arbiter",
      to: "cli",
      kind: "flow_failed",
      payload: failure,
      ts: Date.now(),
    });
  }
});
export {};
