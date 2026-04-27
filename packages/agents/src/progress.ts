import type { AgentRole, AxlEnvelope } from "@zuno/core";
import { AxlClient } from "@zuno/axl";

/**
 * Emit a progress event back to the CLI peer. CLI subscribes to its own
 * inbox and renders these as "spinner lines" while the flow runs.
 */
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
