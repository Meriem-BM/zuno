import type { AgentRole } from "@zuno/core";

export function peerIdFor(role: AgentRole | "cli"): string {
  const key = PEER_ID_ENV[role];
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing ${key}; configure the real AXL peer id for ${role}.`);
  return value;
}

const PEER_ID_ENV: Record<AgentRole | "cli", string> = {
  cli: "ZUNO_AXL_CLI_PEER_ID",
  watcher: "ZUNO_AXL_WATCHER_PEER_ID",
  planner: "ZUNO_AXL_PLANNER_PEER_ID",
  risk: "ZUNO_AXL_RISK_PEER_ID",
};

export function shortPeer(id: string): string {
  return `${id.slice(0, 5)}…${id.slice(-4)}`;
}
