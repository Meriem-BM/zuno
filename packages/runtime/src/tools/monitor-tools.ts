import { monitorIntervalMs } from "@zuno/config";
import type { ToolDefinition } from "../contracts/types.js";
import { alertStore, ok, resolveReadTarget } from "./shared.js";

const monitorWallet: ToolDefinition = {
  name: "monitorWallet",
  intents: ["monitor_wallet"],
  execute: (intent, ctx) => {
    const target = resolveReadTarget(intent, ctx);
    const status = target ? "configured" : "needs_address";
    return ok("monitorWallet", monitorMessage(status), {
      walletAddress: ctx.session.walletAddress,
      watchAddress: target?.address ?? null,
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
  return "Paste a wallet address or set ZUNO_WATCH_ADDRESS before starting the monitor.";
}
