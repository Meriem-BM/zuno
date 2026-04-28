import type {
  ApplyPlanData,
  ConnectWalletData,
  InspectPositionData,
  RecommendRebalanceData,
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
        { key: "wallet", value: shortAddr(d.walletAddress) },
        { key: "chain", value: String(d.chainId) },
        { key: "signer", value: d.signerMode },
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
      const d = data as { positions: { positionId: string; pair: string }[] };
      return [
        { key: "count", value: String(d.positions.length) },
        ...d.positions.map((p) => ({ key: `· ${p.positionId}`, value: p.pair })),
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
      };
      return [
        { key: "planId", value: d.planId },
        { key: "old", value: `${d.oldRange.priceLower.toFixed(2)} → ${d.oldRange.priceUpper.toFixed(2)}` },
        { key: "new", value: `${d.newRange.priceLower.toFixed(2)} → ${d.newRange.priceUpper.toFixed(2)}` },
        { key: "residual", value: `${d.residual.token0} / ${d.residual.token1}` },
      ];
    }

    case "simulatePlan": {
      const d = data as {
        planId: string;
        gasEstimate: string;
        expectedSlippage: number;
        success: boolean;
      };
      return [
        { key: "planId", value: d.planId },
        { key: "gas", value: d.gasEstimate },
        { key: "slippage", value: `${(d.expectedSlippage * 100).toFixed(2)}%` },
        { key: "ok", value: d.success ? "yes" : "no" },
      ];
    }

    case "applyPlan": {
      const d = data as ApplyPlanData;
      return [
        { key: "planId", value: d.planId },
        { key: "tx", value: shortHash(d.txHash) },
        { key: "signer", value: d.signerMode },
        { key: "status", value: d.status },
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

    default:
      return [];
  }
}
