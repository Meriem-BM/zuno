import type { AxlClient } from "@zuno/axl";
import type { AxlEnvelope, InspectRequest, PositionSnapshot } from "@zuno/core";
import { newRequestId } from "@zuno/core";
import { buildSnapshot, getPosition } from "@zuno/uniswap";
import type { Logger } from "../log.js";
import { emitProgress } from "../progress.js";

export async function handleFlowRun(
  client: AxlClient,
  log: Logger,
  env: AxlEnvelope,
): Promise<void> {
  const req = env.payload as InspectRequest;
  log(`flow_run  position=${req.positionId}  from=${env.from}`);

  await emitProgress(client, env.requestId, "watcher", "watcher.read", req.positionId);

  const position = await getPosition(req.positionId);
  const snapshot = buildSnapshot(position);
  log(
    `snapshot  inRange=${snapshot.range.inRange}  ` +
      `tick=${position.pool.currentTick}  range=[${position.tickLower}..${position.tickUpper}]`,
  );

  const proposeEnv: AxlEnvelope<{ requestId: string; snapshot: PositionSnapshot }> = {
    requestId: newRequestId(),
    from: "watcher",
    to: "planner",
    kind: "flow_propose",
    payload: { requestId: env.requestId, snapshot },
    ts: Date.now(),
  };
  await client.send(proposeEnv);
  log(`forwarded → planner`);
}
