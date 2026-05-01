import { AxlClient, peerIdFor, shortPeer, type AxlRole } from "@zuno/strategy/axl";
import type { ToolDefinition } from "../../contracts/types.js";
import { err, ok } from "../shared.js";

const ROLES: AxlRole[] = ["watcher", "planner", "risk"];

const showAgentStatus: ToolDefinition = {
  name: "showAgentStatus",
  intents: ["agent_status"],
  execute: async () => {
    try {
      const topology = await new AxlClient({ role: "cli" }).topology();
      const visible = new Set(topology.peers);
      const status = (role: AxlRole): "online" | "offline" => {
        try {
          return visible.has(peerIdFor(role)) ? "online" : "offline";
        } catch {
          return "offline";
        }
      };
      return ok("showAgentStatus", "Agent topology loaded.", {
        watcher: { status: status("watcher") },
        planner: { status: status("planner") },
        risk: { status: status("risk") },
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
      const visible = new Set(topology.peers);
      const matched = ROLES.flatMap((role) => {
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

export const AGENT_TOOLS: readonly ToolDefinition[] = [showAgentStatus, showPeers, showLogs];
