import type { PlanCandidate, PositionSnapshot, RiskNote } from "@zuno/core";
import {
  ETH_PRICE_USD_FALLBACK,
  REBALANCE_GAS_UNITS,
} from "../../agents/shared/lib/constants.js";
import type { RiskContext } from "./risk-context.js";

const MIN_BUFFER_HOURS = 36;

export interface CritiqueResult {
  recommended: PlanCandidate;
  rejected?: PlanCandidate;
  rejectReason?: string;
  risk: RiskNote;
}

interface RankedCandidate {
  candidate: PlanCandidate;
  bufferHours: number;
  gasFeeRatio: number;
}

export function critiqueWithContext(
  snapshot: PositionSnapshot,
  candidates: readonly PlanCandidate[],
  context: RiskContext,
): CritiqueResult {
  if (candidates.length === 0) throw new Error("no candidates to critique");

  const ranked = candidates.map((c) => assessCandidate(c, context));
  const sorted = [...ranked].sort(compareCandidates);

  const winner = sorted[0]!;
  const loser = sorted.length > 1 ? sorted[1]! : undefined;
  const outOfRange = !snapshot.range.inRange;

  return {
    recommended: winner.candidate,
    rejected: loser?.candidate,
    rejectReason: loser ? buildRejectReason(loser, winner, context) : undefined,
    risk: buildRiskNote(winner, outOfRange, context),
  };
}

function compareCandidates(a: RankedCandidate, b: RankedCandidate): number {
  if (Math.abs(a.bufferHours - b.bufferHours) > 12) return b.bufferHours - a.bufferHours;
  return a.gasFeeRatio - b.gasFeeRatio;
}

function buildRiskNote(
  winner: RankedCandidate,
  outOfRange: boolean,
  context: RiskContext,
): RiskNote {
  const verdict: RiskNote["verdict"] = outOfRange
    ? "approve_with_caution"
    : winner.bufferHours < MIN_BUFFER_HOURS / 2
      ? "reject"
      : winner.bufferHours < MIN_BUFFER_HOURS
        ? "approve_with_caution"
        : "approve";

  const confidence =
    winner.bufferHours >= 72
      ? 0.92
      : winner.bufferHours >= 48
        ? 0.85
        : winner.bufferHours >= 24
          ? 0.74
          : 0.55;

  const reasons = [
    outOfRange
      ? `position is out of range; rebalance restores active liquidity at ~${context.gasGwei.toFixed(2)} gwei`
      : `position is in range; review balances buffer vs fee density at ${context.realizedVolBps}bps realized 24h vol`,
    `selected ${winner.candidate.kind}: ~${Math.round(winner.bufferHours)}h buffer at recent vol; gas/24h-yield ratio ${winner.gasFeeRatio.toFixed(2)}x`,
  ];
  if (winner.bufferHours < MIN_BUFFER_HOURS && !outOfRange) {
    reasons.push(
      `buffer is below ${MIN_BUFFER_HOURS}h floor - consider reducing position size or accepting more drift risk`,
    );
  }

  return { verdict, confidence, reasons };
}

function assessCandidate(candidate: PlanCandidate, context: RiskContext): RankedCandidate {
  const width = candidate.tickUpper - candidate.tickLower;
  const bufferHours = (width / Math.max(context.tickTravel24h, 1)) * 24;
  const gasCostUsd = ((REBALANCE_GAS_UNITS * context.gasGwei) / 1e9) * ETH_PRICE_USD_FALLBACK;
  const gasFeeRatio = gasCostUsd / Math.max(context.feeYield24hUsd, 0.01);
  return { candidate, bufferHours, gasFeeRatio };
}

function buildRejectReason(
  loser: RankedCandidate,
  winner: RankedCandidate,
  context: RiskContext,
): string {
  if (loser.bufferHours < MIN_BUFFER_HOURS) {
    return `${loser.candidate.kind} gives ~${Math.round(loser.bufferHours)}h buffer at recent ${context.realizedVolBps}bps vol - below ${MIN_BUFFER_HOURS}h floor`;
  }
  if (loser.gasFeeRatio > winner.gasFeeRatio * 1.4 && loser.gasFeeRatio > 1.5) {
    return `${loser.candidate.kind} costs ${loser.gasFeeRatio.toFixed(2)}x its 24h fee yield at ${context.gasGwei.toFixed(2)} gwei (winner: ${winner.gasFeeRatio.toFixed(2)}x)`;
  }
  if (loser.bufferHours < winner.bufferHours - 12) {
    return `${loser.candidate.kind} gives ${Math.round(winner.bufferHours - loser.bufferHours)}h less buffer than the selected range`;
  }
  return `${loser.candidate.kind} has marginally weaker buffer/yield tradeoff at recent vol`;
}
