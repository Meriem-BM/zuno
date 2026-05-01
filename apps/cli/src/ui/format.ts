import type {
  AgentWalletBalanceData,
  AgentWalletData,
  ApplyPlanData,
  ApprovePlanData,
  FundAgentWalletData,
  InspectPositionData,
  MonitorWalletData,
  RecommendRebalanceData,
  ApproveTokenSummary,
  NeedsConfirmationData,
  ShowAlertsData,
  ShowAllowancesData,
  ShowBalancesData,
  ShowNetworkData,
  SwapQuoteData,
  SwitchNetworkData,
  ToolExecutionResult,
} from "@zuno/runtime";
import type { Field } from "@zuno/terminal";

export function shortAddr(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-4)}`;
}

function formatAtomic(amount: string | undefined, decimals = 18, symbol = ""): string {
  if (!amount) return symbol ? `0 ${symbol}` : "0";
  try {
    const value = BigInt(amount);
    const scale = 10n ** BigInt(decimals);
    const whole = value / scale;
    const fraction = value % scale;
    const fractionText = fraction
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/u, "")
      .slice(0, 6);
    const text = fractionText ? `${whole.toString()}.${fractionText}` : whole.toString();
    return symbol ? `${text} ${symbol}` : text;
  } catch {
    return symbol ? `${amount} ${symbol}` : amount;
  }
}

export function formatResultData(result: ToolExecutionResult): Field[] {
  if (!result.data) return [];
  const data = result.data;

  switch (result.tool) {
    case "createAgentWallet":
    case "showAgentWallet": {
      const d = data as AgentWalletData;
      return [
        { key: "zuno", value: `${shortAddr(d.agentWalletAddress)} on ${d.chainName}` },
        { key: "provider", value: "turnkey" },
        { key: "status", value: d.status },
        ...(d.walletId ? [{ key: "walletId", value: d.walletId }] : []),
      ];
    }

    case "showAgentWalletBalance": {
      const d = data as AgentWalletBalanceData;
      return [
        { key: "zuno", value: shortAddr(d.agentWalletAddress) },
        { key: "chain", value: d.chainName ?? String(d.chainId) },
        { key: d.native.symbol.toLowerCase(), value: d.native.amount },
        { key: "funded", value: d.funded ? "yes" : "no" },
      ];
    }

    case "fundAgentWallet": {
      const d = data as FundAgentWalletData;
      return [
        { key: "zuno", value: d.agentWalletAddress ? shortAddr(d.agentWalletAddress) : "not set" },
        ...d.instructions.map((instruction) => ({ key: "·", value: instruction })),
      ];
    }

    case "listAgentWalletPositions":
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
      if (d.slippageBps)
        fields.push({ key: "slippage", value: `${(d.slippageBps / 100).toFixed(2)}%` });
      if (d.prepAction) fields.push({ key: "prep", value: d.prepAction });
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
        token0?: { symbol: string; decimals: number };
        token1?: { symbol: string; decimals: number };
        oldRange: { priceLower: number; priceUpper: number };
        newRange: { priceLower: number; priceUpper: number };
        residual: { token0: string; token1: string };
        required?: { token0: string; token1: string };
        shortfall?: { token0: string; token1: string };
        prepAction?: string;
        slippageBps?: number;
        riskNote?: string;
      };
      const token0 = d.token0 ?? { symbol: "token0", decimals: 18 };
      const token1 = d.token1 ?? { symbol: "token1", decimals: 18 };
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
        ...(d.required
          ? [
              {
                key: "required",
                value: `${formatAtomic(d.required.token0, token0.decimals, token0.symbol)} / ${formatAtomic(d.required.token1, token1.decimals, token1.symbol)}`,
              },
            ]
          : []),
        {
          key: "residual",
          value: `${formatAtomic(d.residual.token0, token0.decimals, token0.symbol)} / ${formatAtomic(d.residual.token1, token1.decimals, token1.symbol)}`,
        },
      ];
      if (d.shortfall && (d.shortfall.token0 !== "0" || d.shortfall.token1 !== "0")) {
        fields.push({
          key: "shortfall",
          value: `${formatAtomic(d.shortfall.token0, token0.decimals, token0.symbol)} / ${formatAtomic(d.shortfall.token1, token1.decimals, token1.symbol)}`,
        });
      }
      if (d.slippageBps)
        fields.push({ key: "slippage", value: `${(d.slippageBps / 100).toFixed(2)}%` });
      if (d.prepAction) fields.push({ key: "prep", value: d.prepAction });
      if (d.riskNote) fields.push({ key: "risk", value: d.riskNote });
      return fields;
    }

    case "simulatePlan": {
      const d = data as {
        planId: string;
        gasEstimate: string;
        expectedSlippage: number;
        onchainStatus?: "not_checked" | "passed" | "failed";
        success: boolean;
        steps?: { label: string; detail: string }[];
        warnings?: string[];
      };
      return [
        { key: "planId", value: d.planId },
        { key: "gas", value: d.gasEstimate },
        { key: "slippage", value: `${(d.expectedSlippage * 100).toFixed(2)}%` },
        { key: "simulation", value: d.onchainStatus ?? "not_checked" },
        { key: "ok", value: d.success ? "yes" : "no" },
        ...(d.steps ?? []).map((step) => ({ key: step.label, value: step.detail })),
        ...(d.warnings ?? []).map((warning) => ({ key: "warning", value: warning })),
      ];
    }

    case "applyPlan": {
      const d = data as ApplyPlanData;
      return [
        { key: "planId", value: d.planId },
        { key: "signer", value: `${d.signer} ${shortAddr(d.agentWalletAddress)}` },
        { key: "approval", value: d.approvalState },
        { key: "execution", value: d.executionState },
        { key: "status", value: d.status },
        ...(d.onchainStatus ? [{ key: "simulation", value: d.onchainStatus }] : []),
        ...(d.approvalReadiness ?? []).map((approval) => ({
          key: approval.tokenSymbol.toLowerCase(),
          value: approval.sufficient ? "approved" : "approval required",
        })),
        ...(d.transactionHash ? [{ key: "tx", value: shortHash(d.transactionHash) }] : []),
        ...(d.turnkeyActivityId ? [{ key: "turnkey", value: d.turnkeyActivityId }] : []),
      ];
    }

    case "approvePlan": {
      const d = data as ApprovePlanData;
      return [
        { key: "planId", value: d.planId },
        { key: "zuno", value: shortAddr(d.agentWalletAddress) },
        { key: "approval", value: d.approvalState },
        { key: "execution", value: d.executionState },
        ...d.warnings.map((warning) => ({ key: "warning", value: warning })),
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
        { key: "zuno", value: d.agentWalletAddress ? shortAddr(d.agentWalletAddress) : "not set" },
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

    case "showBalances": {
      const d = data as ShowBalancesData;
      return [
        { key: "zuno", value: shortAddr(d.agentWalletAddress) },
        { key: "chain", value: d.chainName },
        { key: d.native.symbol.toLowerCase(), value: d.native.amount },
        ...d.tokens.map((t) => ({ key: t.symbol.toLowerCase(), value: t.amount })),
      ];
    }

    case "showNetwork": {
      const d = data as ShowNetworkData;
      return [
        { key: "chain", value: `${d.chainName} (${d.chainId})` },
        { key: "native", value: d.nativeSymbol },
        { key: "rpc", value: d.rpcConfigured ? "custom" : "public default" },
        { key: "supported", value: d.supported.map((s) => s.name).join(", ") },
      ];
    }

    case "switchNetwork": {
      const d = data as SwitchNetworkData;
      return [
        { key: "from", value: String(d.previousChainId) },
        { key: "to", value: `${d.chainName} (${d.chainId})` },
      ];
    }

    case "approveToken": {
      const d = data as NeedsConfirmationData<ApproveTokenSummary>;
      const summary = d.preparedAction.summary;
      return [
        { key: "token", value: summary.tokenSymbol },
        { key: "amount", value: summary.amount },
        { key: "spender", value: summary.spenderLabel },
        { key: "chain", value: summary.chainName },
        { key: "id", value: d.preparedAction.id },
      ];
    }

    case "prepareSwap":
    case "showQuote": {
      const d = data as SwapQuoteData;
      return [
        { key: "in", value: `${d.amountIn} ${d.tokenIn.symbol}` },
        { key: "out", value: `${d.amountOut} ${d.tokenOut.symbol}` },
        { key: "min", value: `${d.minimumOut} ${d.tokenOut.symbol}` },
        { key: "fee", value: `${(d.feeTier / 10_000).toFixed(2)}%` },
        { key: "route", value: d.route },
        ...d.notes.map((note) => ({ key: "note", value: note })),
      ];
    }

    case "showAllowances": {
      const d = data as ShowAllowancesData;
      if (d.allowances.length === 0) {
        return [
          { key: "spender", value: d.spenderLabel },
          { key: "allowances", value: "none configured yet" },
        ];
      }
      return [
        { key: "spender", value: `${d.spenderLabel}  ${shortAddr(d.spender)}` },
        ...d.allowances.map((a) => ({
          key: a.token.symbol.toLowerCase(),
          value: a.sufficient === false ? `${a.allowance}  (insufficient)` : a.allowance,
        })),
      ];
    }

    default:
      return [];
  }
}
