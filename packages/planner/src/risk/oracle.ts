import type { Pool, PositionSnapshot } from "@zuno/core";
import { defaultRiskContext, type RiskContext } from "../planning/index.js";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4_000;

interface MarketPoint {
  timestamp: number;
  price: number;
}

interface CachedSeries {
  fetchedAt: number;
  prices: MarketPoint[];
}

const seriesCache = new Map<string, CachedSeries>();

/**
 * Map known token symbols to CoinGecko coin ids. Symbols not on this list
 * fall through to the deterministic risk context — Risk reports the
 * `source` so the user can tell which path produced its veto.
 */
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  eth: "ethereum",
  weth: "ethereum",
  wbtc: "wrapped-bitcoin",
  btc: "bitcoin",
  arb: "arbitrum",
  op: "optimism",
  matic: "matic-network",
  link: "chainlink",
  uni: "uniswap",
  ldo: "lido-dao",
};

const STABLECOINS = new Set(["usdc", "usdt", "dai", "frax", "lusd", "tusd", "usde"]);

export interface RiskOracleOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export async function loadRiskContext(
  snapshot: PositionSnapshot,
  options: RiskOracleOptions = {},
): Promise<RiskContext> {
  try {
    const measurement = await fetchVolatility(snapshot.position.pool, options);
    if (!measurement) return defaultRiskContext(snapshot);
    return mergeContext(snapshot, measurement);
  } catch {
    return defaultRiskContext(snapshot);
  }
}

interface VolMeasurement {
  realizedVolBps: number;
  tickTravel24h: number;
  source: string;
}

async function fetchVolatility(
  pool: Pool,
  options: RiskOracleOptions,
): Promise<VolMeasurement | null> {
  const subject = pickSubjectSymbol(pool);
  if (!subject) return null;
  const coinId = SYMBOL_TO_COINGECKO_ID[subject];
  if (!coinId) return null;

  const cached = seriesCache.get(coinId);
  let prices: MarketPoint[];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    prices = cached.prices;
  } else {
    prices = await fetchMarketChart(coinId, options);
    if (prices.length === 0) return null;
    seriesCache.set(coinId, { fetchedAt: Date.now(), prices });
  }

  if (prices.length < 6) return null;

  const realizedVolBps = computeRealizedVolBps(prices);
  const priceRange = priceRangeRatio(prices);
  const observedTickTravel = Math.round(Math.log(priceRange) / Math.log(1.0001));
  const tickTravel24h = Math.max(pool.tickSpacing * 4, Math.abs(observedTickTravel));

  return { realizedVolBps, tickTravel24h, source: `coingecko:${coinId}` };
}

function pickSubjectSymbol(pool: Pool): string | null {
  const t0 = pool.token0.symbol.toLowerCase();
  const t1 = pool.token1.symbol.toLowerCase();
  if (!STABLECOINS.has(t0)) return t0;
  if (!STABLECOINS.has(t1)) return t1;
  return null;
}

async function fetchMarketChart(
  coinId: string,
  options: RiskOracleOptions,
): Promise<MarketPoint[]> {
  const fetchFn = options.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  options.signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=1`;
    const res = await fetchFn(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const json = (await res.json()) as { prices?: [number, number][] };
    if (!json.prices) return [];
    return json.prices.map(([timestamp, price]) => ({ timestamp, price }));
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

function computeRealizedVolBps(prices: MarketPoint[]): number {
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

function priceRangeRatio(prices: MarketPoint[]): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of prices) {
    if (p.price < lo) lo = p.price;
    if (p.price > hi) hi = p.price;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0) return 1;
  return hi / lo;
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
  seriesCache.clear();
}
