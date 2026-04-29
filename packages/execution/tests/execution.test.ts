import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Plan } from "@zuno/core";
import { prepareApply, simulatePlan } from "../src/index.js";

const plan: Plan = {
  id: "plan_test",
  positionId: "42",
  createdAt: 1,
  snapshot: {
    takenAt: 1,
    range: {
      inRange: false,
      distanceFromBoundary: 10,
      utilization: 1.1,
      priceLower: 100,
      priceUpper: 110,
      priceCurrent: 112,
    },
    position: {
      id: "42",
      owner: "0xabc1230000000000000000000000000000000def",
      tickLower: 1,
      tickUpper: 2,
      liquidity: "1000",
      amount0: "100",
      amount1: "200",
      feesOwed0: "1",
      feesOwed1: "2",
      pool: {
        address: "0x0000000000000000000000000000000000000001",
        chainId: 42161,
        token0: {
          address: "0x0000000000000000000000000000000000000002",
          symbol: "WETH",
          decimals: 18,
        },
        token1: {
          address: "0x0000000000000000000000000000000000000003",
          symbol: "USDC",
          decimals: 6,
        },
        feeTier: 500,
        tickSpacing: 10,
        currentTick: 3,
        sqrtPriceX96: "0",
        liquidity: "1000",
        price: 112,
      },
    },
  },
  recommended: {
    kind: "shift",
    tickLower: 1,
    tickUpper: 4,
    priceLower: 101,
    priceUpper: 116,
    deploy0: "50",
    deploy1: "100",
    residual0: "10",
    residual1: "20",
    rationale: "shift range",
  },
  risk: {
    verdict: "approve_with_caution",
    confidence: 0.82,
    reasons: ["position is out of range"],
  },
};

describe("execution preview", () => {
  it("simulates deterministic steps before apply", async () => {
    const simulation = simulatePlan(plan);
    assert.equal(simulation.canApply, true);
    assert.ok(simulation.steps.length >= 4);
    assert.ok(simulation.warnings.some((warning) => /out of range/iu.test(warning)));
  });

  it("prepares wallet signing without submitting from the terminal", async () => {
    const preview = prepareApply(plan, "wallet");
    assert.equal(preview.status, "requires_wallet_signature");
    assert.match(preview.summary, /wallet/iu);
  });

  it("blocks enclave mode until authority is configured", async () => {
    const preview = prepareApply(plan, "enclave");
    assert.equal(preview.status, "blocked");
    assert.ok(preview.warnings.some((warning) => /enclave/iu.test(warning)));
  });
});
