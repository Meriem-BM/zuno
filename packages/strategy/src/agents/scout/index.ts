import type {
  AxlEnvelope,
  CreateContext,
  CreateStart,
  FlowFailed,
  FlowStart,
  MarketContext,
} from "@zuno/core";
import { defaultChainId } from "@zuno/chain/config";
import { AxlClient } from "../../axl/index.js";
import { makeLogger } from "../shared/log.js";
import { axlThoughtChannel } from "../shared/transcript.js";
import { runScout, runScoutCreate } from "./handler.js";

const log = makeLogger("scout");
const client = new AxlClient({ role: "scout" });

log(`online  peer=${client.peerId.slice(0, 12)}…  axl=${client.apiUrl}`);

await client.listen(async (env) => {
  if (env.kind === "flow_start") {
    const start = env.payload as FlowStart;
    log(`flow_start  position=${start.positionId}  from=${env.from}`);
    try {
      const channel = axlThoughtChannel(client, env.requestId, "scout");
      const context = await runScout({ start, channel });
      const next: AxlEnvelope<MarketContext & { riskProfile: FlowStart["riskProfile"] }> = {
        requestId: env.requestId,
        from: "scout",
        to: "strategist",
        kind: "context_observed",
        payload: { ...context, riskProfile: start.riskProfile },
        ts: Date.now(),
      };
      await client.send(next);
      log(`forwarded → strategist  regime=${context.regime}`);
    } catch (err) {
      await failFlow(env.requestId, err);
    }
    return;
  }

  if (env.kind === "flow_create_start") {
    const start = env.payload as CreateStart;
    const chainId = start.goal.chain ?? defaultChainId();
    log(`flow_create_start  chain=${chainId}  from=${env.from}`);
    try {
      const channel = axlThoughtChannel(client, env.requestId, "scout");
      const context = await runScoutCreate({ start, chainId, channel });
      const next: AxlEnvelope<
        CreateContext & { riskProfile?: CreateStart["goal"]["riskProfile"] }
      > = {
        requestId: env.requestId,
        from: "scout",
        to: "strategist",
        kind: "context_observed",
        payload: { ...context, riskProfile: start.goal.riskProfile },
        ts: Date.now(),
      };
      await client.send(next);
      log(`forwarded → strategist (create)  pools=${context.surveyedPools.length}`);
    } catch (err) {
      await failFlow(env.requestId, err);
    }
  }
});

async function failFlow(requestId: string, err: unknown): Promise<void> {
  const failure: FlowFailed = {
    stage: "scout",
    message: err instanceof Error ? err.message : String(err),
  };
  log(`flow_failed  ${failure.message}`);
  await client.send({
    requestId,
    from: "scout",
    to: "cli",
    kind: "flow_failed",
    payload: failure,
    ts: Date.now(),
  });
}
export {};
