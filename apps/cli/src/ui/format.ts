import type {
  ApplyPlanData,
  ConnectWalletData,
  InspectPositionData,
  MonitorWalletData,
  RecommendRebalanceData,
  ShowAlertsData,
  ShowWatchTargetData,
  ToolExecutionResult,
} from "@zuno/runtime";
import type { Field } from "@zuno/ui-terminal";

export function shortAddr(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-4)}`;
}

export function formatResultData(result: ToolExecutionResult): Field[] {
  if (!result.data) return [];
  const data = result.data;

  switch (result.tool) {
    case "connectWallet": {
      const d = data as ConnectWalletData;
      return [
        { key: "watch", value: `${shortAddr(d.watchAddress)} on ${d.chainName}` },
        { key: "execution", value: "QR approval only when applying a plan" },
      ];
    }

    case "showWatchTarget": {
      const d = data as ShowWatchTargetData;
      return [
        {
          key: "watch",
          value: d.watchAddress
            ? `${shortAddr(d.watchAddress)} on ${d.chainName ?? "unknown chain"}`
            : "not set",
        },
        {
          key: "mode",
          value: d.execution === "wallet_connected" ? "execution wallet connected" : "read-only",
        },
        ...(d.walletAddress ? [{ key: "exec", value: shortAddr(d.walletAddress) }] : []),
      ];
    }

    case "showWalletBalance": {
      const d = data as { walletAddress: string; balances: { token: string; amount: string }[] };
      return [
        { key: "wallet", value: shortAddr(d.walletAddress) },
        ...d.balances.map((b) => ({ key: b.token.toLowerCase(), value: b.amount })),
      ];
    }

    case "listWalletPositions":
    case "inspectAllPositions":
    case "listOutOfRangePositions": {
      const d = data as { positions: { positionId: string; pair: string; feeTier?: number }[] };
      if (d.positions.length === 0) {
        return [{ key: "positions", value: "none found" }];
      }
      return [
        { key: "count", value: String(d.positions.length) },
        ...d.positions.map((p) => ({
          key: `· ${p.positionId}`,
          value: p.feeTier ? `${p.pair}  ${(p.feeTier / 10_000).toFixed(2)}%` : p.pair,
        })),
      ];
    }

    case "listRiskyPositions": {
      const d = data as { positions: { positionId: string; pair: string; reason: string }[] };
      return [
        { key: "count", value: String(d.positions.length) },
        ...d.positions.flatMap((p) => [
          { key: `· ${p.positionId}`, value: p.pair },
          { key: "reason", value: p.reason },
        ]),
      ];
    }

    case "inspectPosition": {
      const d = data as InspectPositionData;
      return [
        { key: "position", value: d.positionId },
        { key: "pair", value: `${d.pair}  ${(d.feeTier / 10_000).toFixed(2)}%` },
        { key: "range", value: `${d.priceLower.toFixed(2)} → ${d.priceUpper.toFixed(2)}` },
        { key: "current", value: d.priceCurrent.toFixed(2) },
        { key: "status", value: d.rangeStatus.replace("_", " ").toLowerCase() },
        ...(typeof d.utilization === "number"
          ? [{ key: "utilization", value: `${(d.utilization * 100).toFixed(0)}%` }]
          : []),
      ];
    }

    case "checkRangeStatus": {
      const d = data as {
        positionId: string;
        rangeStatus: "IN_RANGE" | "OUT_OF_RANGE";
        priceLower: number;
        priceUpper: number;
        priceCurrent: number;
      };
      return [
        { key: "position", value: d.positionId },
        { key: "range", value: `${d.priceLower.toFixed(2)} → ${d.priceUpper.toFixed(2)}` },
        { key: "current", value: d.priceCurrent.toFixed(2) },
        { key: "status", value: d.rangeStatus.replace("_", " ").toLowerCase() },
      ];
    }

    case "recommendRebalance": {
      const d = data as RecommendRebalanceData;
      const fields: Field[] = [
        { key: "planId", value: d.planId },
        { key: "verdict", value: `${d.verdict}  ${d.confidence.toFixed(2)}` },
        {
          key: "recommended",
          value: `${d.recommended.priceLower.toFixed(2)} → ${d.recommended.priceUpper.toFixed(2)}  (${d.recommended.kind})`,
        },
      ];
      if (d.rejected) {
        fields.push({
          key: "rejected",
          value: `${d.rejected.priceLower.toFixed(2)} → ${d.rejected.priceUpper.toFixed(2)}  (${d.rejected.kind})`,
        });
      }
      if (d.rejectReason) fields.push({ key: "reason", value: d.rejectReason });
      return fields;
    }

    case "showRebalanceOptions": {
      const d = data as {
        positionId: string;
        options: { kind: string; priceLower: number; priceUpper: number }[];
      };
      return [
        { key: "position", value: d.positionId },
        ...d.options.map((o) => ({
          key: o.kind,
          value: `${o.priceLower.toFixed(2)} → ${o.priceUpper.toFixed(2)}`,
        })),
      ];
    }

    case "explainRecommendation": {
      const d = data as {
        planId: string;
        verdict: string;
        confidence: number;
        reasons: string[];
      };
      return [
        { key: "planId", value: d.planId },
        { key: "verdict", value: `${d.verdict}  ${d.confidence.toFixed(2)}` },
        ...d.reasons.map((r, i) => ({ key: i === 0 ? "reason" : "·", value: r })),
      ];
    }

    case "showPlanDiff": {
      const d = data as {
        planId: string;
        oldRange: { priceLower: number; priceUpper: number };
        newRange: { priceLower: number; priceUpper: number };
        residual: { token0: string; token1: string };
        riskNote?: string;
      };
      const fields: Field[] = [
        { key: "planId", value: d.planId },
        {
          key: "old",
          value: `${d.oldRange.priceLower.toFixed(2)} → ${d.oldRange.priceUpper.toFixed(2)}`,
        },
        {
          key: "new",
          value: `${d.newRange.priceLower.toFixed(2)} → ${d.newRange.priceUpper.toFixed(2)}`,
        },
        { key: "residual", value: `${d.residual.token0} / ${d.residual.token1}` },
      ];
      if (d.riskNote) fields.push({ key: "risk", value: d.riskNote });
      return fields;
    }

    case "simulatePlan": {
      const d = data as {
        planId: string;
        gasEstimate: string;
        expectedSlippage: number;
        success: boolean;
        steps?: { label: string; detail: string }[];
        warnings?: string[];
      };
      return [
        { key: "planId", value: d.planId },
        { key: "gas", value: d.gasEstimate },
        { key: "slippage", value: `${(d.expectedSlippage * 100).toFixed(2)}%` },
        { key: "ok", value: d.success ? "yes" : "no" },
        ...(d.steps ?? []).map((step) => ({ key: step.label, value: step.detail })),
        ...(d.warnings ?? []).map((warning) => ({ key: "warning", value: warning })),
      ];
    }

    case "applyPlan": {
      const d = data as ApplyPlanData;
      return [
        { key: "planId", value: d.planId },
        { key: "approval", value: approvalStatus(d.approval.status) },
        { key: "status", value: d.status },
        { key: "summary", value: d.summary },
        ...d.approval.instructions.map((instruction) => ({ key: "·", value: instruction })),
      ];
    }

    case "showAgentStatus": {
      const d = data as Record<"watcher" | "planner" | "risk", { status: string }>;
      return (["watcher", "planner", "risk"] as const).map((role) => ({
        key: role,
        value: d[role].status,
      }));
    }

    case "showPeers": {
      const d = data as { peers: { peerId: string; role: string }[] };
      return [
        { key: "count", value: String(d.peers.length) },
        ...d.peers.map((p) => ({ key: p.role, value: p.peerId })),
      ];
    }

    case "showLogs": {
      const d = data as { lines: string[] };
      return d.lines.map((line, i) => ({ key: `· ${i + 1}`, value: line }));
    }

    case "monitorWallet": {
      const d = data as MonitorWalletData;
      return [
        { key: "status", value: d.status },
        { key: "watch", value: d.watchAddress ? shortAddr(d.watchAddress) : "not set" },
        { key: "chain", value: d.chainId ? String(d.chainId) : "not configured" },
        { key: "interval", value: `${Math.round(d.intervalMs / 1000)}s` },
        { key: "command", value: d.command },
      ];
    }

    case "showAlerts": {
      const d = data as ShowAlertsData;
      if (d.alerts.length === 0) return [{ key: "status", value: "no alerts" }];
      return [
        { key: "count", value: String(d.alerts.length) },
        ...d.alerts.flatMap((alert) => [
          { key: `· ${alert.positionId}`, value: `${alert.severity}  ${alert.kind}` },
          { key: "reason", value: alert.reason },
        ]),
      ];
    }

    default:
      return [];
  }
}

function approvalStatus(status: ApplyPlanData["approval"]["status"]): string {
  if (status === "ready") return "wallet QR ready";
  if (status === "requires_session") return "create WalletConnect session";
  return "wallet QR needs REOWN_PROJECT_ID";
}
