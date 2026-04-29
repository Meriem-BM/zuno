import { newPlanId } from "@zuno/core";
import type { Plan, PlanCandidate, PlanDiff, PositionSnapshot, RiskNote } from "@zuno/core";
import { nearestUsableTick, tickToPrice } from "@zuno/uniswap";

export interface CritiqueResult {
  recommended: PlanCandidate;
  rejected?: PlanCandidate;
  rejectReason?: string;
  risk: RiskNote;
}

export interface RiskContext {
  realizedVolBps: number;
  tickTravel24h: number;
  gasGwei: number;
  feeYield24hUsd: number;
  source: string;
}

export const MIN_BUFFER_HOURS = 36;

const halve = (value: string): string => (BigInt(value || "0") / 2n).toString();
const tenth = (value: string): string => (BigInt(value || "0") / 10n).toString();

export function recommendPlan(snapshot: PositionSnapshot, context?: RiskContext): Plan {
  const candidates = proposeCandidates(snapshot);
  const reviewed = critiqueWithContext(
    snapshot,
    candidates,
    context ?? defaultRiskContext(snapshot),
  );
  return {
    id: newPlanId(),
    positionId: snapshot.position.id,
    createdAt: Date.now(),
    snapshot,
    ...reviewed,
  };
}

export function proposeCandidates(snapshot: PositionSnapshot): PlanCandidate[] {
  const { position, range } = snapshot;
  const { pool } = position;
  const width = position.tickUpper - position.tickLower;
  const spacing = pool.tickSpacing;
  const currentTick = pool.currentTick;

  const wideWidth = Math.max(spacing * 2, nearestUsableTick(Math.round(width * 1.4), spacing));
  const tightWidth = Math.max(spacing * 2, nearestUsableTick(Math.round(width * 0.65), spacing));

  return [
    candidate(
      range.inRange ? "widen" : "shift",
      currentTick,
      wideWidth,
      snapshot,
      "Recenter on current tick with a wider range to restore buffer before fee density.",
    ),
    candidate(
      "tighten",
      currentTick,
      tightWidth,
      snapshot,
      "Tighter band around current tick. Higher fee density, but weaker protection if volatility persists.",
    ),
  ];
}

export function critiqueCandidates(
  snapshot: PositionSnapshot,
  candidates: readonly PlanCandidate[],
): CritiqueResult {
  return critiqueWithContext(snapshot, candidates, defaultRiskContext(snapshot));
}

export function critiqueWithContext(
  snapshot: PositionSnapshot,
  candidates: readonly PlanCandidate[],
  context: RiskContext,
): CritiqueResult {
  if (candidates.length === 0) throw new Error("no candidates to critique");

  const ranked = candidates.map((c) => assessCandidate(c, context));

  const sorted = [...ranked].sort((a, b) => {
    if (Math.abs(a.bufferHours - b.bufferHours) > 12) return b.bufferHours - a.bufferHours;
    return a.gasFeeRatio - b.gasFeeRatio;
  });

  const winner = sorted[0]!;
  const loser = sorted.length > 1 ? sorted[1]! : undefined;
  const outOfRange = !snapshot.range.inRange;

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

  const reasons: string[] = [];
  reasons.push(
    outOfRange
      ? `position is out of range; rebalance restores active liquidity at ~${context.gasGwei.toFixed(2)} gwei`
      : `position is in range; review balances buffer vs fee density at ${context.realizedVolBps}bps realized 24h vol`,
  );
  reasons.push(
    `selected ${winner.candidate.kind}: ~${Math.round(winner.bufferHours)}h buffer at recent vol; gas/24h-yield ratio ${winner.gasFeeRatio.toFixed(2)}x`,
  );
  if (winner.bufferHours < MIN_BUFFER_HOURS && !outOfRange) {
    reasons.push(
      `buffer is below ${MIN_BUFFER_HOURS}h floor — consider reducing position size or accepting more drift risk`,
    );
  }

  return {
    recommended: winner.candidate,
    rejected: loser?.candidate,
    rejectReason: loser ? buildRejectReason(loser, winner, context) : undefined,
    risk: { verdict, confidence, reasons },
  };
}

export function defaultRiskContext(snapshot: PositionSnapshot): RiskContext {
  const pool = snapshot.position.pool;
  const seed = simpleHash(`${pool.address}:${pool.feeTier}`);
  const realizedVolBps = 90 + (seed % 280); // 90..370 bps
  const tickTravel24h = Math.max(
    pool.tickSpacing * 4,
    Math.round((realizedVolBps / 100) * pool.tickSpacing * 2.4),
  );
  const gasGwei =
    pool.chainId === 1
      ? 28 + ((seed >> 4) % 18)
      : pool.chainId === 8453
        ? 0.04 + ((seed >> 8) % 6) / 100
        : pool.chainId === 10
          ? 0.001 + ((seed >> 8) % 9) / 1000
          : 0.06 + ((seed >> 8) % 12) / 100;
  const liquidityScale =
    pool.liquidity.length > 18 ? Number(pool.liquidity.slice(0, pool.liquidity.length - 12)) : 1;
  const feeYield24hUsd = Math.max(0.5, (liquidityScale * pool.feeTier) / 10_000 / 365);
  return {
    realizedVolBps,
    tickTravel24h,
    gasGwei,
    feeYield24hUsd,
    source: "deterministic-snapshot",
  };
}

export function buildPlanDiff(plan: Plan): PlanDiff {
  const { snapshot, recommended } = plan;
  return {
    planId: plan.id,
    oldRange: {
      tickLower: snapshot.position.tickLower,
      tickUpper: snapshot.position.tickUpper,
      priceLower: snapshot.range.priceLower,
      priceUpper: snapshot.range.priceUpper,
    },
    newRange: {
      tickLower: recommended.tickLower,
      tickUpper: recommended.tickUpper,
      priceLower: recommended.priceLower,
      priceUpper: recommended.priceUpper,
    },
    current: {
      amount0: snapshot.position.amount0,
      amount1: snapshot.position.amount1,
    },
    proposed: {
      amount0: recommended.deploy0,
      amount1: recommended.deploy1,
    },
    residual: {
      amount0: recommended.residual0,
      amount1: recommended.residual1,
    },
    riskNote: plan.risk.reasons[0] ?? plan.risk.verdict,
  };
}

interface RankedCandidate {
  candidate: PlanCandidate;
  bufferHours: number;
  gasCostUsd: number;
  gasFeeRatio: number;
}

function assessCandidate(candidate: PlanCandidate, context: RiskContext): RankedCandidate {
  const width = candidate.tickUpper - candidate.tickLower;
  const bufferHours = (width / Math.max(context.tickTravel24h, 1)) * 24;
  // Approximate Uniswap V3 mint+burn cost ≈ 350k gas. ETH ≈ $2000 proxy.
  const gasCostUsd = ((350_000 * context.gasGwei) / 1e9) * 2000;
  const gasFeeRatio = gasCostUsd / Math.max(context.feeYield24hUsd, 0.01);
  return { candidate, bufferHours, gasCostUsd, gasFeeRatio };
}

function buildRejectReason(
  loser: RankedCandidate,
  winner: RankedCandidate,
  context: RiskContext,
): string {
  if (loser.bufferHours < MIN_BUFFER_HOURS) {
    return `${loser.candidate.kind} gives ~${Math.round(loser.bufferHours)}h buffer at recent ${context.realizedVolBps}bps vol — below ${MIN_BUFFER_HOURS}h floor`;
  }
  if (loser.gasFeeRatio > winner.gasFeeRatio * 1.4 && loser.gasFeeRatio > 1.5) {
    return `${loser.candidate.kind} costs ${loser.gasFeeRatio.toFixed(2)}x its 24h fee yield at ${context.gasGwei.toFixed(2)} gwei (winner: ${winner.gasFeeRatio.toFixed(2)}x)`;
  }
  if (loser.bufferHours < winner.bufferHours - 12) {
    return `${loser.candidate.kind} gives ${Math.round(winner.bufferHours - loser.bufferHours)}h less buffer than the selected range`;
  }
  return `${loser.candidate.kind} has marginally weaker buffer/yield tradeoff at recent vol`;
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function candidate(
  kind: PlanCandidate["kind"],
  currentTick: number,
  width: number,
  snapshot: PositionSnapshot,
  rationale: string,
): PlanCandidate {
  const { position } = snapshot;
  const lower = nearestUsableTick(currentTick - width / 2, position.pool.tickSpacing);
  const upper = nearestUsableTick(currentTick + width / 2, position.pool.tickSpacing);
  return {
    kind,
    tickLower: lower,
    tickUpper: upper,
    priceLower: tickToPrice(lower, position.pool.token0.decimals, position.pool.token1.decimals),
    priceUpper: tickToPrice(upper, position.pool.token0.decimals, position.pool.token1.decimals),
    deploy0: halve(position.amount0),
    deploy1: halve(position.amount1),
    residual0: tenth(position.amount0),
    residual1: tenth(position.amount1),
    rationale,
  };
}
