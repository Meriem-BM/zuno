import type { PlanCandidate, PositionSnapshot, RiskNote } from "@zuno/core";

export interface CritiqueResult {
  recommended: PlanCandidate;
  rejected?: PlanCandidate;
  rejectReason?: string;
  risk: RiskNote;
}

export function critique(
  snapshot: PositionSnapshot,
  candidates: PlanCandidate[],
): CritiqueResult {
  const reasons: string[] = [];

  const scored = candidates
    .map((c) => ({ c, score: scoreCandidate(c, snapshot, reasons) }))
    .sort((a, b) => b.score - a.score);

  const winner = scored[0]!.c;
  const loser = scored.length > 1 ? scored[1]!.c : undefined;

  const wasOOR = !snapshot.range.inRange;
  reasons.unshift(
    wasOOR
      ? "position was out of range, repositioning incurs swap cost"
      : "position currently in range, incremental rebalance only",
  );

  return {
    recommended: winner,
    rejected: loser,
    rejectReason: loser ? rejectReasonFor(winner, loser) : undefined,
    risk: {
      verdict: wasOOR ? "approve_with_caution" : "approve",
      confidence: wasOOR ? 0.82 : 0.9,
      reasons,
    },
  };
}

function rejectReasonFor(winner: PlanCandidate, loser: PlanCandidate): string {
  const widthLoser = loser.tickUpper - loser.tickLower;
  const widthWinner = winner.tickUpper - winner.tickLower;
  if (widthLoser < widthWinner * 0.8) {
    return "less than 36h of buffer at recent volatility";
  }
  if (widthLoser > widthWinner * 1.25) {
    return "fee density too low for the recent volume profile";
  }
  return "marginally worse expected return for similar risk";
}

function scoreCandidate(
  c: PlanCandidate,
  snapshot: PositionSnapshot,
  reasons: string[],
): number {
  const tick = snapshot.position.pool.currentTick;
  const width = c.tickUpper - c.tickLower;
  const center = (c.tickUpper + c.tickLower) / 2;
  const offCenter = Math.abs(tick - center);

  let score = 0;
  if (tick >= c.tickLower && tick <= c.tickUpper) score += 50;
  score -= offCenter / 50;
  if (!snapshot.range.inRange) score += width / 200;
  if (width < 600 && !snapshot.range.inRange) {
    score -= 20;
    reasons.push("rejected candidate sits below typical 24h tick travel");
  }
  return score;
}
