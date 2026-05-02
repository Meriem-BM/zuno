import { AGENT_ROLES, AxlClient, peerIdFor, shortPeer } from "@zuno/strategy/axl";
import { refreshPoolsCache } from "@zuno/strategy/agents";
import { defaultChainId } from "@zuno/chain/config";
import type { ToolDefinition } from "../../contracts/types.js";
import { err, ok, resolveAgentWallet } from "../shared.js";

const showAgentStatus: ToolDefinition = {
  name: "showAgentStatus",
  intents: ["agent_status"],
  execute: async () => {
    try {
      const topology = await new AxlClient({ role: "cli" }).topology();
      const visible = new Set(topology.peers);
      const status = (role: (typeof AGENT_ROLES)[number]): "online" | "offline" => {
        try {
          return visible.has(peerIdFor(role)) ? "online" : "offline";
        } catch {
          return "offline";
        }
      };
      const data = Object.fromEntries(
        AGENT_ROLES.map((role) => [role, { status: status(role) }]),
      ) as Record<(typeof AGENT_ROLES)[number], { status: string }>;
      return ok("showAgentStatus", "Agent topology loaded.", data);
    } catch (error) {
      return err(
        "showAgentStatus",
        "CHAIN_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  },
};

const showPeers: ToolDefinition = {
  name: "showPeers",
  intents: ["show_peers"],
  execute: async () => {
    try {
      const topology = await new AxlClient({ role: "cli" }).topology();
      const visible = new Set(topology.peers);
      const matched = AGENT_ROLES.flatMap((role) => {
        try {
          const id = peerIdFor(role);
          return visible.has(id) ? [{ role, peerId: id }] : [];
        } catch {
          return [];
        }
      });
      return ok("showPeers", `${topology.peers.length} peers connected.`, {
        ourPublicKey: topology.ourPublicKey,
        peers: matched.map((entry) => ({
          peerId: shortPeer(entry.peerId),
          role: entry.role,
        })),
      });
    } catch (error) {
      return err(
        "showPeers",
        "CHAIN_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  },
};

const showLogs: ToolDefinition = {
  name: "showLogs",
  intents: ["show_logs"],
  execute: () =>
    err(
      "showLogs",
      "EXECUTION_NOT_AVAILABLE",
      "Agent log streaming is not configured. Use your AXL node or process supervisor logs.",
    ),
};

const refreshPools: ToolDefinition = {
  name: "refreshPools",
  intents: ["refresh_pools"],
  execute: async (_, ctx) => {
    const target = resolveAgentWallet(ctx);
    const chainId = target?.chainId ?? defaultChainId();
    try {
      const entries = await refreshPoolsCache(chainId);
      return ok(
        "refreshPools",
        `Discovered ${entries.length} pools on chain ${chainId}.`,
        {
          chainId,
          count: entries.length,
          pools: entries.map((e) => ({
            pair: `${e.pool.token0.symbol}/${e.pool.token1.symbol}`,
            feeTier: e.pool.feeTier,
            currentTick: e.pool.currentTick,
            liquidity: e.pool.liquidity,
            poolId: e.poolId,
          })),
        },
      );
    } catch (error) {
      return err(
        "refreshPools",
        "CHAIN_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  },
};

export const AGENT_TOOLS: readonly ToolDefinition[] = [
  showAgentStatus,
  showPeers,
  showLogs,
  refreshPools,
];
