import type { AgentRole } from "@zuno/core";

export type AxlRole = AgentRole | "cli";

const PEER_ID_ENV: Record<AxlRole, string> = {
  cli: "ZUNO_AXL_CLI_PEER_ID",
  watcher: "ZUNO_AXL_WATCHER_PEER_ID",
  planner: "ZUNO_AXL_PLANNER_PEER_ID",
  risk: "ZUNO_AXL_RISK_PEER_ID",
};

const API_URL_ENV: Record<AxlRole, string> = {
  cli: "ZUNO_AXL_CLI_API_URL",
  watcher: "ZUNO_AXL_WATCHER_API_URL",
  planner: "ZUNO_AXL_PLANNER_API_URL",
  risk: "ZUNO_AXL_RISK_API_URL",
};

const DEFAULT_API_URL: Record<AxlRole, string> = {
  cli: "http://127.0.0.1:9002",
  watcher: "http://127.0.0.1:9012",
  planner: "http://127.0.0.1:9022",
  risk: "http://127.0.0.1:9032",
};

export function peerIdFor(role: AxlRole): string {
  const key = PEER_ID_ENV[role];
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing ${key}; configure the real AXL peer id for ${role}.`);
  return value;
}

export function apiUrlFor(role: AxlRole): string {
  return process.env[API_URL_ENV[role]]?.trim() || DEFAULT_API_URL[role];
}

export function shortPeer(id: string): string {
  return `${id.slice(0, 5)}…${id.slice(-4)}`;
}
