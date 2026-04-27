import type { AxlClient } from "@zuno/axl";
import type { AxlEnvelope, Plan, PlanCandidate, PositionSnapshot } from "@zuno/core";
import { newPlanId } from "@zuno/core";
import type { Logger } from "../log.js";
import { emitProgress } from "../progress.js";
import { critique } from "./critique.js";

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

  await emitProgress(
    client,
    flowId,
    "risk",
    "risk.critique",
    `${candidates.length} candidates`,
  );

  const { recommended, rejected, rejectReason, risk } = critique(snapshot, candidates);

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
