import { monitorIntervalMs } from "@zuno/chain/config";
import type { ToolDefinition } from "../../contracts/types.js";
import { alertStore, ok, resolveAgentWallet } from "../shared.js";

const monitorWallet: ToolDefinition = {
  name: "monitorWallet",
  intents: ["monitor_wallet"],
  execute: (_, ctx) => {
    const target = resolveAgentWallet(ctx);
    const status = target ? "configured" : "needs_address";
    return ok("monitorWallet", monitorMessage(status), {
      userWalletAddress: ctx.session.userWalletAddress,
      agentWalletAddress: target?.address ?? null,
      chainId: target?.chainId ?? ctx.session.chainId,
      intervalMs: monitorIntervalMs(),
      command: "pnpm monitor",
      status,
    });
  },
};

const showAlerts: ToolDefinition = {
  name: "showAlerts",
  intents: ["show_alerts"],
  execute: async (_, ctx) => {
    const alerts = await alertStore(ctx).list(10);
    return ok("showAlerts", `${alerts.length} recent alert${alerts.length === 1 ? "" : "s"}.`, {
      alerts,
    });
  },
};

export const MONITOR_TOOLS: readonly ToolDefinition[] = [monitorWallet, showAlerts];

function monitorMessage(status: "configured" | "needs_address"): string {
  if (status === "configured") {
    return "Background monitor is configured. Run `pnpm monitor` in a separate terminal.";
  }
  return "Create or attach a Zuno wallet before starting the monitor.";
}
