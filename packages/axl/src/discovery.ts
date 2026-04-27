import { createHash } from "node:crypto";
import type { AgentRole } from "@zuno/core";

/**
 * Real AXL peer ids are ed25519 keys. Locally we shape stable, ed25519-looking
 * identifiers from the role name so they're easy to spot when debugging.
 */
export function peerIdFor(role: AgentRole | "cli"): string {
  const h = createHash("sha256").update(`zuno:${role}`).digest("hex");
  return `z${h.slice(0, 40)}`;
}

export const ROLE_PEERS: Record<AgentRole | "cli", string> = {
  cli: peerIdFor("cli"),
  watcher: peerIdFor("watcher"),
  planner: peerIdFor("planner"),
  risk: peerIdFor("risk"),
};

export function shortPeer(id: string): string {
  return `${id.slice(0, 5)}…${id.slice(-4)}`;
}
