import type { Pool } from "@zuno/core";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4_000;

export interface MarketDataOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export interface MarketPoint {
  timestamp: number;
  price: number;
}

interface CachedSeries {
  fetchedAt: number;
  prices: MarketPoint[];
}

const seriesCache = new Map<string, CachedSeries>();

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

export async function fetchCachedMarketSeries(
  pool: Pool,
  options: MarketDataOptions,
): Promise<{ coinId: string; prices: MarketPoint[] } | null> {
  const coinId = coinGeckoIdForPool(pool);
  if (!coinId) return null;

  const cached = seriesCache.get(coinId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { coinId, prices: cached.prices };
  }

  const prices = await fetchMarketChart(coinId, options);
  if (prices.length === 0) return null;
  seriesCache.set(coinId, { fetchedAt: Date.now(), prices });
  return { coinId, prices };
}

export function clearMarketSeriesCache(): void {
  seriesCache.clear();
}

function coinGeckoIdForPool(pool: Pool): string | null {
  const subject = pickSubjectSymbol(pool);
  return subject ? (SYMBOL_TO_COINGECKO_ID[subject] ?? null) : null;
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
  options: MarketDataOptions,
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
