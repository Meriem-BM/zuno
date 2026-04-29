import type { AxlClient } from "@zuno/axl";
import type { AxlEnvelope, PlanCandidate, PositionSnapshot } from "@zuno/core";
import { newRequestId } from "@zuno/core";
import { proposeCandidates } from "@zuno/planner";
import type { Logger } from "../shared/log.js";
import { emitProgress } from "../shared/progress.js";

interface ProposePayload {
  requestId: string;
  snapshot: PositionSnapshot;
}

export async function handleFlowPropose(
  client: AxlClient,
  log: Logger,
  env: AxlEnvelope,
): Promise<void> {
  const { requestId: flowId, snapshot } = env.payload as ProposePayload;
  log(`propose  flow=${flowId.slice(0, 10)}  inRange=${snapshot.range.inRange}`);

  await emitProgress(client, flowId, "planner", "planner.propose");

  const candidates = proposeCandidates(snapshot);
  log(
    `candidates  ${candidates
      .map((c) => `${c.kind}[${c.priceLower.toFixed(0)}-${c.priceUpper.toFixed(0)}]`)
      .join("  ")}`,
  );

  const reviewEnv: AxlEnvelope<{
    requestId: string;
    snapshot: PositionSnapshot;
    candidates: PlanCandidate[];
  }> = {
    requestId: newRequestId(),
    from: "planner",
    to: "risk",
    kind: "flow_review",
    payload: { requestId: flowId, snapshot, candidates },
    ts: Date.now(),
  };
  await client.send(reviewEnv);
  log(`forwarded → risk`);
}
