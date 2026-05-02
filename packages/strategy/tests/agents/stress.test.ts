import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlanCandidate, PositionSnapshot } from "@zuno/core";
import { stressCandidate, stressProfile, bufferHours } from "../../src/agents/shared/lib/stress.js";

describe("stress simulator", () => {
  it("hours-until-exit scales inversely with vol multiplier", () => {
    const a = stressCandidate({
      candidate,
      snapshot,
      tickTravel24h: 240,
      multiplier: 1,
    });
    const b = stressCandidate({
      candidate,
      snapshot,
      tickTravel24h: 240,
      multiplier: 2,
    });
    assert.ok(a.hoursUntilExit > 0, `expected base buffer > 0 got ${a.hoursUntilExit}`);
    assert.ok(b.hoursUntilExit > 0, "expected 2x buffer > 0");
    assert.ok(
      a.hoursUntilExit > b.hoursUntilExit,
      `1× should give more time than 2×; got ${a.hoursUntilExit} vs ${b.hoursUntilExit}`,
    );
  });

  it("flags out-of-range candidates immediately", () => {
    const oor: PlanCandidate = { ...candidate, tickLower: 200, tickUpper: 300 };
    const result = stressCandidate({
      candidate: oor,
      snapshot,
      tickTravel24h: 240,
      multiplier: 1,
    });
    assert.equal(result.startsOutOfRange, true);
    assert.equal(result.hoursUntilExit, 0);
  });

  it("stressProfile returns 1×, 2×, 3× ordered by stress", () => {
    const profile = stressProfile({ candidate, snapshot, tickTravel24h: 240 });
    assert.ok(profile.base >= profile.double, "base should be >= 2x");
    assert.ok(profile.double >= profile.triple, "2x should be >= 3x");
  });

  it("bufferHours produces a finite positive number for a valid candidate", () => {
    const h = bufferHours(candidate, 240);
    assert.ok(Number.isFinite(h));
    assert.ok(h > 0);
  });
});

const candidate: PlanCandidate = {
  kind: "widen",
  tickLower: -200,
  tickUpper: 200,
  priceLower: 0.98,
  priceUpper: 1.02,
  deploy0: "0",
  deploy1: "0",
  residual0: "0",
  residual1: "0",
  rationale: "test",
};

const snapshot: PositionSnapshot = {
  takenAt: Date.now(),
  range: {
    inRange: true,
    distanceFromBoundary: 200,
    utilization: 0.5,
    priceLower: 0.98,
    priceUpper: 1.02,
    priceCurrent: 1.0,
  },
  position: {
    id: "test",
    owner: "0x0000000000000000000000000000000000000000",
    tickLower: -200,
    tickUpper: 200,
    liquidity: "0",
    amount0: "0",
    amount1: "0",
    feesOwed0: "0",
    feesOwed1: "0",
    pool: {
      address: "0x0000000000000000000000000000000000000000",
      chainId: 1,
      token0: { address: "0x0", symbol: "T0", decimals: 18 },
      token1: { address: "0x0", symbol: "T1", decimals: 18 },
      feeTier: 3000,
      tickSpacing: 60,
      currentTick: 0,
      sqrtPriceX96: "0",
      liquidity: "1000000000000000000",
      price: 1,
    },
  },
};
