import type { AxlClient } from "../../axl/index.js";
import type { AxlEnvelope, Plan, PlanCandidate, PositionSnapshot } from "@zuno/core";
import { newPlanId } from "@zuno/core";
import { critiqueWithContext, loadRiskContext } from "../../planner/index.js";
import type { Logger } from "../shared/log.js";
import { emitProgress } from "../shared/progress.js";

interface ReviewPayload {
  requestId: string;
  snapshot: PositionSnapshot;
  candidates: PlanCandidate[];
}

export async function handleFlowReview(
  client: AxlClient,
  log: Logger,
  env: AxlEnvelope,
): Promise<void> {
  const { requestId: flowId, snapshot, candidates } = env.payload as ReviewPayload;
  log(`review  flow=${flowId.slice(0, 10)}  candidates=${candidates.length}`);

  const context = await loadRiskContext(snapshot);
  log(
    `context  vol=${context.realizedVolBps}bps  travel24h=${context.tickTravel24h}t  gas=${context.gasGwei.toFixed(2)}gwei  yield24h=$${context.feeYield24hUsd.toFixed(2)}  source=${context.source}`,
  );

  await emitProgress(
    client,
    flowId,
    "risk",
    "risk.critique",
    `${candidates.length} candidates · vol ${context.realizedVolBps}bps · gas ${context.gasGwei.toFixed(2)}gwei`,
  );

  const { recommended, rejected, rejectReason, risk } = critiqueWithContext(
    snapshot,
    candidates,
    context,
  );

  const plan: Plan = {
    id: newPlanId(),
    positionId: snapshot.position.id,
    createdAt: Date.now(),
    snapshot,
    recommended,
    rejected,
    rejectReason,
    risk,
  };

  log(
    `verdict  ${risk.verdict}  conf=${risk.confidence.toFixed(2)}  recommended=${recommended.kind}`,
  );
  if (rejectReason) log(`reject   ${rejectReason}`);

  const finalEnv: AxlEnvelope<Plan> = {
    requestId: flowId,
    from: "risk",
    to: "cli",
    kind: "flow_run:done",
    payload: plan,
    ts: Date.now(),
  };
  await client.send(finalEnv);
  log(`delivered → cli`);
}
