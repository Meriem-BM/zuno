import type { Plan, PlanDiff } from "@zuno/core";

export function buildPlanDiff(plan: Plan): PlanDiff {
  const { snapshot, recommended } = plan;
  return {
    planId: plan.id,
    pair: `${snapshot.position.pool.token0.symbol}/${snapshot.position.pool.token1.symbol}`,
    token0: {
      symbol: snapshot.position.pool.token0.symbol,
      decimals: snapshot.position.pool.token0.decimals,
    },
    token1: {
      symbol: snapshot.position.pool.token1.symbol,
      decimals: snapshot.position.pool.token1.decimals,
    },
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
    required: {
      amount0: recommended.required0 ?? recommended.deploy0,
      amount1: recommended.required1 ?? recommended.deploy1,
    },
    shortfall: {
      amount0: recommended.shortfall0 ?? "0",
      amount1: recommended.shortfall1 ?? "0",
    },
    prepAction: recommended.prepAction,
    slippageBps: recommended.slippageBps,
    riskNote: plan.risk.reasons[0] ?? plan.risk.verdict,
  };
}
