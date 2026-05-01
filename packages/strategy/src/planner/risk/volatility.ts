import type { Pool } from "@zuno/core";
import type { MarketPoint } from "./market-data.js";

export interface VolMeasurement {
  realizedVolBps: number;
  tickTravel24h: number;
  source: string;
}

export function measureVolatility(
  pool: Pool,
  coinId: string,
  prices: readonly MarketPoint[],
): VolMeasurement | null {
  if (prices.length < 6) return null;

  const realizedVolBps = computeRealizedVolBps(prices);
  const priceRange = priceRangeRatio(prices);
  const observedTickTravel = Math.round(Math.log(priceRange) / Math.log(1.0001));
  const tickTravel24h = Math.max(pool.tickSpacing * 4, Math.abs(observedTickTravel));

  return { realizedVolBps, tickTravel24h, source: `coingecko:${coinId}` };
}

function computeRealizedVolBps(prices: readonly MarketPoint[]): number {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1]!.price;
    const curr = prices[i]!.price;
    if (prev > 0 && curr > 0) {
      const r = Math.log(curr / prev);
      if (Number.isFinite(r)) returns.push(r);
    }
  }
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const sigma = Math.sqrt(variance);
  const dayStd = sigma * Math.sqrt(returns.length);
  return Math.round(dayStd * 10_000);
}

function priceRangeRatio(prices: readonly MarketPoint[]): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of prices) {
    if (p.price < lo) lo = p.price;
    if (p.price > hi) hi = p.price;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0) return 1;
  return hi / lo;
}
