import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { STANDARD_FEE_TIERS, discoverPools } from "../../src/agents/shared/lib/pools.js";

/**
 * Pool discovery tests.
 *
 * The discovery flow makes real on-chain reads via viem. Rather than
 * mocking the chain layer (brittle), we test the pure pieces - fee-tier
 * enumeration, filter logic - and exercise the live path under a gated
 * RPC env var so it can be skipped in CI without one.
 */

describe("STANDARD_FEE_TIERS", () => {
  it("matches Uniswap v4 canonical tiers", () => {
    assert.deepEqual([...STANDARD_FEE_TIERS], [100, 500, 3000, 10000]);
  });
});

describe("discoverPools - filtering on cached entries", () => {
  let cacheDir: string;
  let originalCacheDir: string | undefined;

  beforeEach(() => {
    originalCacheDir = process.env.ZUNO_POOL_CACHE_DIR;
    cacheDir = mkdtempSync(join(tmpdir(), "zuno-pools-"));
    process.env.ZUNO_POOL_CACHE_DIR = cacheDir;
  });

  afterEach(() => {
    if (originalCacheDir === undefined) delete process.env.ZUNO_POOL_CACHE_DIR;
    else process.env.ZUNO_POOL_CACHE_DIR = originalCacheDir;
  });

  it("filters by pinnedFeeTier", async () => {
    seedCache(cacheDir, 11155111, fixtures);
    const pools = await discoverPools(11155111, { pinnedFeeTier: 500 });
    assert.equal(pools.length, 1);
    assert.equal(pools[0]!.pool.feeTier, 500);
  });

  it("filters by pinnedPair (order-insensitive)", async () => {
    seedCache(cacheDir, 11155111, fixtures);
    const a = await discoverPools(11155111, {
      pinnedPair: { token0Symbol: "WETH", token1Symbol: "USDC" },
    });
    const b = await discoverPools(11155111, {
      pinnedPair: { token0Symbol: "USDC", token1Symbol: "WETH" },
    });
    assert.equal(a.length, b.length);
    assert.equal(a.length, 2);
    assert.ok(a.every((e) => /WETH|USDC/u.test(e.pool.token0.symbol + e.pool.token1.symbol)));
  });

  it("filters by containingToken with eth/weth alias", async () => {
    seedCache(cacheDir, 11155111, fixtures);
    const pools = await discoverPools(11155111, { containingToken: "eth" });
    assert.equal(pools.length, 2);
    for (const p of pools) {
      const symbols = `${p.pool.token0.symbol}/${p.pool.token1.symbol}`;
      assert.match(symbols, /WETH/u);
    }
  });

  it("returns zero pools when chain has no entries", async () => {
    seedCache(cacheDir, 11155111, []);
    const pools = await discoverPools(11155111, {});
    assert.equal(pools.length, 0);
  });
});

const wethSepolia = {
  address: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
  symbol: "WETH",
  decimals: 18,
};
const usdcSepolia = {
  address: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
  symbol: "USDC",
  decimals: 6,
};
const fixtures = [
  poolEntry(500, wethSepolia, usdcSepolia, "12345678901234567890"),
  poolEntry(3000, wethSepolia, usdcSepolia, "9876543210987654321"),
];

interface FixtureToken {
  address: string;
  symbol: string;
  decimals: number;
}

function poolEntry(
  feeTier: number,
  token0: FixtureToken,
  token1: FixtureToken,
  liquidity: string,
) {
  return {
    poolManager: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
    poolId: `0x${feeTier.toString(16).padStart(64, "0")}`,
    pool: {
      address: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
      chainId: 11155111,
      token0,
      token1,
      feeTier,
      tickSpacing: feeTier === 500 ? 10 : 60,
      currentTick: 200000,
      sqrtPriceX96: "1234567890000000000000000",
      liquidity,
      price: 2400,
    },
  };
}

function seedCache(dir: string, chainId: number, entries: ReturnType<typeof poolEntry>[]): void {
  writeFileSync(
    join(dir, `pools-${chainId}.json`),
    JSON.stringify({
      fetchedAt: Date.now(),
      chainId,
      entries,
    }),
  );
}
