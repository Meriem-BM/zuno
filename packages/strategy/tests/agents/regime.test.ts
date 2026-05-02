import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PositionSnapshot } from "@zuno/core";
import { classifyRegime, regimeCaption } from "../../src/agents/shared/lib/regime.js";

describe("regime classifier", () => {
  it("returns 'stressed' for very high vol", () => {
    const r = classifyRegime({ realizedVolBps: 420, snapshot: snap(true, 0.4), gasGwei: 10 });
    assert.equal(r, "stressed");
  });

  it("returns 'volatile' for elevated vol", () => {
    const r = classifyRegime({ realizedVolBps: 260, snapshot: snap(true, 0.4), gasGwei: 10 });
    assert.equal(r, "volatile");
  });

  it("returns 'trending' for moderate vol with high utilization", () => {
    const r = classifyRegime({ realizedVolBps: 160, snapshot: snap(true, 0.85), gasGwei: 10 });
    assert.equal(r, "trending");
  });

  it("returns 'ranging' for calm in-range positions", () => {
    const r = classifyRegime({ realizedVolBps: 90, snapshot: snap(true, 0.3), gasGwei: 5 });
    assert.equal(r, "ranging");
  });

  it("escalates to stressed on gas spikes even when vol is calm", () => {
    const r = classifyRegime({ realizedVolBps: 80, snapshot: snap(true, 0.3), gasGwei: 120 });
    assert.equal(r, "stressed");
  });

  it("every regime has a caption", () => {
    for (const regime of ["ranging", "trending", "volatile", "stressed"] as const) {
      assert.ok(regimeCaption(regime).length > 5, `caption missing for ${regime}`);
    }
  });
});

function snap(inRange: boolean, utilization: number): PositionSnapshot {
  return {
    takenAt: Date.now(),
    range: {
      inRange,
      distanceFromBoundary: inRange ? 100 : -50,
      utilization,
      priceLower: 0.98,
      priceUpper: 1.02,
      priceCurrent: 1.0,
    },
    position: {
      id: "x",
      owner: "0x0000000000000000000000000000000000000000",
      tickLower: -200,
      tickUpper: 200,
      liquidity: "0",
      amount0: "0",
      amount1: "0",
      feesOwed0: "0",
      feesOwed1: "0",
      pool: {
        address: "0x0",
        chainId: 1,
        token0: { address: "0x0", symbol: "A", decimals: 18 },
        token1: { address: "0x0", symbol: "B", decimals: 18 },
        feeTier: 3000,
        tickSpacing: 60,
        currentTick: 0,
        sqrtPriceX96: "0",
        liquidity: "0",
        price: 1,
      },
    },
  };
}
