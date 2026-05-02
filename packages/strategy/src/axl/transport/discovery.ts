import type { AgentRole } from "@zuno/core";

export type AxlRole = AgentRole;

const PEER_ID_ENV: Record<AxlRole, string> = {
  cli: "ZUNO_AXL_CLI_PEER_ID",
  scout: "ZUNO_AXL_SCOUT_PEER_ID",
  strategist: "ZUNO_AXL_STRATEGIST_PEER_ID",
  critic: "ZUNO_AXL_CRITIC_PEER_ID",
  arbiter: "ZUNO_AXL_ARBITER_PEER_ID",
};

const API_URL_ENV: Record<AxlRole, string> = {
  cli: "ZUNO_AXL_CLI_API_URL",
  scout: "ZUNO_AXL_SCOUT_API_URL",
  strategist: "ZUNO_AXL_STRATEGIST_API_URL",
  critic: "ZUNO_AXL_CRITIC_API_URL",
  arbiter: "ZUNO_AXL_ARBITER_API_URL",
};

const DEFAULT_API_URL: Record<AxlRole, string> = {
  cli: "http://127.0.0.1:9002",
  scout: "http://127.0.0.1:9012",
  strategist: "http://127.0.0.1:9022",
  critic: "http://127.0.0.1:9032",
  arbiter: "http://127.0.0.1:9042",
};

export const AGENT_ROLES: readonly Exclude<AxlRole, "cli">[] = [
  "scout",
  "strategist",
  "critic",
  "arbiter",
];

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
