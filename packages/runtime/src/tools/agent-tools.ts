import type { ToolDefinition } from "../types.js";
import { ok } from "./shared.js";

const showAgentStatus: ToolDefinition = {
  name: "showAgentStatus",
  intents: ["agent_status"],
  execute: () =>
    ok("showAgentStatus", "All 3 agents online.", {
      watcher: { status: "online", lastSeen: Date.now() },
      planner: { status: "online", lastSeen: Date.now() },
      risk: { status: "online", lastSeen: Date.now() },
    }),
};

const showPeers: ToolDefinition = {
  name: "showPeers",
  intents: ["show_peers"],
  execute: () =>
    ok("showPeers", "4 peers connected.", {
      peers: [
        { peerId: "z3f4a…b201", role: "cli" },
        { peerId: "z9d2c…a102", role: "watcher" },
        { peerId: "z7e1b…c903", role: "planner" },
        { peerId: "z4a8d…d804", role: "risk" },
      ],
    }),
};

const showLogs: ToolDefinition = {
  name: "showLogs",
  intents: ["show_logs"],
  execute: () =>
    ok("showLogs", "Recent log entries.", {
      lines: [
        "watcher  online  peer=z9d2c…",
        "planner  online  peer=z7e1b…",
        "risk     online  peer=z4a8d…",
      ],
    }),
};

export const AGENT_TOOLS: readonly ToolDefinition[] = [
  showAgentStatus,
  showPeers,
  showLogs,
];
