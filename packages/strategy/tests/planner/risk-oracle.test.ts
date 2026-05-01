import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Address, Position, Token } from "@zuno/core";
import { buildSnapshot, tickToPrice } from "@zuno/chain/uniswap";
import { _clearOracleCache, loadRiskContext } from "../../src/planner/risk/oracle.js";

function priceSeries(start: number, points: number, jitterPct: number): [number, number][] {
  const out: [number, number][] = [];
  let value = start;
  for (let i = 0; i < points; i++) {
    const direction = i % 2 === 0 ? 1 : -1;
    value = value * (1 + direction * jitterPct);
    out.push([Date.now() - (points - i) * 5 * 60_000, value]);
  }
  return out;
}

describe("loadRiskContext — live oracle path", () => {
  beforeEach(() => {
    _clearOracleCache();
  });

  it("computes vol from a fetched series and reports the source", async () => {
    const snapshot = buildSnapshot(position("42", -199_400, -198_400, -198_330));
    const fetchImpl = async () =>
      new Response(JSON.stringify({ prices: priceSeries(2000, 60, 0.005) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const context = await loadRiskContext(snapshot, { fetchImpl });
    assert.match(context.source, /^coingecko:/u);
    assert.ok(context.realizedVolBps > 0, `expected vol>0, got ${context.realizedVolBps}`);
    assert.ok(context.tickTravel24h > 0);
  });

  it("falls back to deterministic when the fetch fails", async () => {
    const snapshot = buildSnapshot(position("42", -199_400, -198_400, -198_330));
    const fetchImpl = async () => new Response("fail", { status: 503 });
    const context = await loadRiskContext(snapshot, { fetchImpl });
    assert.equal(context.source, "deterministic-snapshot");
    assert.ok(context.realizedVolBps > 0);
  });

  it("falls back to deterministic for stable/stable pools", async () => {
    const base = buildSnapshot(position("42", -199_400, -198_400, -198_330));
    const snapshot = {
      ...base,
      position: {
        ...base.position,
        pool: {
          ...base.position.pool,
          token0: { ...base.position.pool.token0, symbol: "USDC" },
          token1: { ...base.position.pool.token1, symbol: "DAI" },
        },
      },
    };
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return new Response("[]", { status: 200 });
    };
    const context = await loadRiskContext(snapshot, { fetchImpl });
    assert.equal(called, false, "no live fetch when both tokens are stable");
    assert.equal(context.source, "deterministic-snapshot");
  });

  it("caches the series so repeated calls only fetch once", async () => {
    _clearOracleCache();
    const snapshot = buildSnapshot(position("42", -199_400, -198_400, -198_330));
    let fetchCount = 0;
    const fetchImpl = async () => {
      fetchCount++;
      return new Response(JSON.stringify({ prices: priceSeries(2000, 60, 0.003) }), {
        status: 200,
      });
    };
    await loadRiskContext(snapshot, { fetchImpl });
    await loadRiskContext(snapshot, { fetchImpl });
    await loadRiskContext(snapshot, { fetchImpl });
    assert.equal(fetchCount, 1, "cache should suppress duplicate fetches");
  });
});

const owner = "0xabc1230000000000000000000000000000000def" as Address;
const token0: Token = {
  address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  symbol: "WETH",
  decimals: 18,
};
const token1: Token = {
  address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  symbol: "USDC",
  decimals: 6,
};

function position(id: string, tickLower: number, tickUpper: number, currentTick: number): Position {
  return {
    id,
    owner,
    pool: {
      address: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
      chainId: 1,
      token0,
      token1,
      feeTier: 500,
      tickSpacing: 10,
      currentTick,
      sqrtPriceX96: "0",
      liquidity: "12345678901234567890",
      price: tickToPrice(currentTick, token0.decimals, token1.decimals),
    },
    tickLower,
    tickUpper,
    liquidity: "5840291203487120349",
    amount0: "418000000000000000",
    amount1: "0",
    feesOwed0: "8200000000000000",
    feesOwed1: "12400000",
  };
}
