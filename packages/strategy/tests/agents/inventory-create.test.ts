import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Pool } from "@zuno/core";
import { allocateForCreate } from "../../src/planner/planning/inventory.js";

describe("allocateForCreate", () => {
  it("returns zero when capital is zero", () => {
    const r = allocateForCreate({
      pool: testPool(),
      tickLower: -200,
      tickUpper: 200,
      capitalAmount: 0n,
      capitalToken: "token0",
    });
    assert.equal(r.amount0, "0");
    assert.equal(r.amount1, "0");
    assert.equal(r.needsSwap, false);
  });

  it("flags needsSwap when ETH-side capital must cover token1 too", () => {
    const r = allocateForCreate({
      pool: testPool(),
      tickLower: -200,
      tickUpper: 200,
      capitalAmount: 10n ** 18n, // 1 ETH
      capitalToken: "token0",
    });
    assert.ok(BigInt(r.amount0) > 0n, "amount0 deposit > 0");
    assert.ok(BigInt(r.amount1) > 0n, "amount1 also required for centered range");
    assert.equal(r.needsSwap, true);
    assert.match(r.prepAction ?? "", /swap.*WETH.*USDC/iu);
  });

  it("flags only one side when range sits above current price (token0 capital, no swap)", () => {
    // Range entirely above current price → only token0 needed.
    // User has token0 → no swap required, capital lands fully in token0 side.
    const r = allocateForCreate({
      pool: testPool(),
      tickLower: 500,
      tickUpper: 1000,
      capitalAmount: 10n ** 18n,
      capitalToken: "token0",
    });
    assert.equal(r.amount1, "0");
    assert.ok(BigInt(r.amount0) > 0n);
    assert.equal(r.needsSwap, false);
  });
});

function testPool(): Pool {
  return {
    address: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
    chainId: 11155111,
    token0: { address: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14", symbol: "WETH", decimals: 18 },
    token1: { address: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238", symbol: "USDC", decimals: 6 },
    feeTier: 500,
    tickSpacing: 10,
    currentTick: 0,
    sqrtPriceX96: "79228162514264337593543950336", // ~1.0
    liquidity: "1000000000000000000",
    price: 1,
  };
}
