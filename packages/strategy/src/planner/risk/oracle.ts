import type { PositionSnapshot } from "@zuno/core";
import { defaultRiskContext, type RiskContext } from "../planning/index.js";
import {
  clearMarketSeriesCache,
  fetchCachedMarketSeries,
  type MarketDataOptions,
} from "./market-data.js";
import { measureVolatility, type VolMeasurement } from "./volatility.js";

export type RiskOracleOptions = MarketDataOptions;

export async function loadRiskContext(
  snapshot: PositionSnapshot,
  options: RiskOracleOptions = {},
): Promise<RiskContext> {
  try {
    const series = await fetchCachedMarketSeries(snapshot.position.pool, options);
    const measurement = series
      ? measureVolatility(snapshot.position.pool, series.coinId, series.prices)
      : null;
    if (!measurement) return defaultRiskContext(snapshot);
    return mergeContext(snapshot, measurement);
  } catch {
    return defaultRiskContext(snapshot);
  }
}

function mergeContext(snapshot: PositionSnapshot, vol: VolMeasurement): RiskContext {
  const fallback = defaultRiskContext(snapshot);
  return {
    realizedVolBps: vol.realizedVolBps,
    tickTravel24h: vol.tickTravel24h,
    gasGwei: fallback.gasGwei,
    feeYield24hUsd: fallback.feeYield24hUsd,
    source: vol.source,
  };
}

export function _clearOracleCache(): void {
  clearMarketSeriesCache();
}
