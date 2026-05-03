import {
  newRequestId,
  type AgentThought,
  type AxlEnvelope,
  type AxlKind,
  type Plan,
  type PlanReady,
} from "@zuno/core";
import { AGENT_ROLES, AxlClient, peerIdFor } from "@zuno/strategy/axl";

const EARLY_ABORT_MS = 10_000;
const POLL_SLEEP_MS = 150;

export interface MeshFlowOptions<P> {
  kind: AxlKind;
  payload: P;
  deadlineMs: number;
  onAgentThought?: (thought: AgentThought) => void;
}

// Sends a flow envelope to scout via the AXL mesh and waits for plan_ready.
// Returns null on any mesh-side failure (incomplete topology, send error,
// silent agents, flow_failed, timeout) so the caller can fall through to the
// in-process orchestrator.
export async function runMeshFlow<P>(opts: MeshFlowOptions<P>): Promise<Plan | null> {
  let client: AxlClient;
  try {
    client = new AxlClient({ role: "cli", pollIntervalMs: POLL_SLEEP_MS });
    const topology = await client.topology();
    const visible = new Set(topology.peers);
    for (const role of AGENT_ROLES) {
      if (!visible.has(peerIdFor(role))) return null;
    }
  } catch {
    return null;
  }

  const requestId = newRequestId();
  const env: AxlEnvelope<P> = {
    requestId,
    from: "cli",
    to: "scout",
    kind: opts.kind,
    payload: opts.payload,
    ts: Date.now(),
  };
  try {
    await client.send(env);
  } catch {
    return null;
  }

  const transcript: AgentThought[] = [];
  const startedAt = Date.now();
  const deadline = startedAt + opts.deadlineMs;
  // Visible AXL nodes don't imply live agent processes; abort early if silent.
  let receivedAny = false;
  while (Date.now() < deadline) {
    let inbox: AxlEnvelope[];
    try {
      inbox = await client.recv();
    } catch {
      return null;
    }
    for (const msg of inbox) {
      if (msg.requestId !== requestId) continue;
      receivedAny = true;
      if (msg.kind === "agent_thought") {
        const thought = msg.payload as AgentThought;
        transcript.push(thought);
        opts.onAgentThought?.(thought);
        continue;
      }
      if (msg.kind === "plan_ready") {
        const ready = msg.payload as PlanReady;
        return attachTranscript(ready.plan, [...transcript, ...(ready.transcript ?? [])]);
      }
      if (msg.kind === "flow_failed") return null;
    }
    if (!receivedAny && Date.now() - startedAt > EARLY_ABORT_MS) return null;
    await sleep(POLL_SLEEP_MS);
  }
  return null;
}

export function attachTranscript(plan: Plan, transcript: AgentThought[]): Plan {
  if (transcript.length === 0) return plan;
  const lines = transcript.map((t) => `[${t.role}] ${t.text}`);
  return { ...plan, risk: { ...plan.risk, reasons: [...plan.risk.reasons, ...lines] } };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
