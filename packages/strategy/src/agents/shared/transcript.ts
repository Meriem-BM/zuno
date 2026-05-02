import type { AgentRole, AgentThought, AxlEnvelope } from "@zuno/core";
import type { AxlClient } from "../../axl/index.js";

export type ThoughtSink = (thought: AgentThought) => void | Promise<void>;

export interface ThoughtChannel {
  emit(thought: AgentThought): Promise<void>;
  history(): AgentThought[];
}

// AXL-backed sink: sends thoughts as envelopes to the CLI peer.
export function axlThoughtChannel(
  client: AxlClient,
  requestId: string,
  role: Exclude<AgentRole, "cli">,
): ThoughtChannel {
  const buffer: AgentThought[] = [];
  return {
    async emit(thought) {
      const stamped: AgentThought = { ...thought, role: thought.role ?? role };
      buffer.push(stamped);
      const env: AxlEnvelope<AgentThought> = {
        requestId,
        from: role,
        to: "cli",
        kind: "agent_thought",
        payload: stamped,
        ts: Date.now(),
      };
      // Best-effort: critic/arbiter still receive the running transcript via
      // history() inside structural envelopes, so a dropped narration line
      // never breaks decision-making.
      try {
        await client.send(env);
      } catch {}
    },
    history: () => [...buffer],
  };
}
