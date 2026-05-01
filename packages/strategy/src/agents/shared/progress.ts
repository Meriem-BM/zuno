import type { AxlClient } from "../../axl/index.js";
import type { AgentRole, AxlEnvelope } from "@zuno/core";
export async function emitProgress(
  client: AxlClient,
  requestId: string,
  from: AgentRole,
  stage: string,
  detail?: string,
): Promise<void> {
  const env: AxlEnvelope<{ stage: string; detail?: string }> = {
    requestId,
    from,
    to: "cli",
    kind: "progress",
    payload: { stage, detail },
    ts: Date.now(),
  };
  await client.send(env).catch(console.error);
}
