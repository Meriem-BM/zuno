import { AxlClient, shortPeer } from "@zuno/axl";
import type { ToolDefinition } from "../contracts/types.js";
import { err, ok } from "./shared.js";

const showAgentStatus: ToolDefinition = {
  name: "showAgentStatus",
  intents: ["agent_status"],
  execute: async () => {
    try {
      const peers = await new AxlClient({ role: "cli" }).topology();
      const roles = new Set(peers.peers.map((peer) => peer.role));
      return ok("showAgentStatus", "Agent topology loaded.", {
        watcher: { status: roles.has("watcher") ? "online" : "offline" },
        planner: { status: roles.has("planner") ? "online" : "offline" },
        risk: { status: roles.has("risk") ? "online" : "offline" },
      });
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
      return ok("showPeers", `${topology.peers.length} peers connected.`, {
        peers: topology.peers.map((peer) => ({
          peerId: shortPeer(peer.peerId),
          role: peer.role,
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

export const AGENT_TOOLS: readonly ToolDefinition[] = [showAgentStatus, showPeers, showLogs];
