import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { Address, Plan } from "@zuno/core";
import { prepareApply, simulatePlan } from "../src/index.js";

const agentWallet = "0xabc1230000000000000000000000000000000def" as Address;

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
  afterEach(() => {
    delete process.env.ZUNO_UNISWAP_REBALANCE_CALLDATA;
  });

  it("simulates deterministic steps before apply", async () => {
    const simulation = await simulatePlan(plan);
    assert.equal(simulation.canApply, true);
    assert.ok(simulation.steps.length >= 4);
    assert.ok(simulation.warnings.some((warning) => /out of range/iu.test(warning)));
    assert.equal(simulation.onchainStatus, "not_checked");
  });

  it("prepares a Turnkey-ready multicall via the deterministic builder", async () => {
    const preview = await prepareApply(plan, agentWallet);
    assert.equal(preview.status, "ready_for_turnkey");
    assert.equal(preview.policy.allowed, true);
    assert.equal(preview.transaction?.from, agentWallet);
    // multicall(bytes[]) selector is 0xac9650d8
    assert.ok(preview.transaction?.data.startsWith("0xac9650d8"), "expected multicall selector");
  });

  it("honors the dev override when ZUNO_UNISWAP_REBALANCE_CALLDATA is set", async () => {
    process.env.ZUNO_UNISWAP_REBALANCE_CALLDATA = "0x1234";
    const preview = await prepareApply(plan, agentWallet);
    assert.equal(preview.status, "ready_for_turnkey");
    assert.equal(preview.transaction?.data, "0x1234");
  });

  it("blocks when liquidity is zero so no rebalance can be built", async () => {
    const zero = {
      ...plan,
      snapshot: { ...plan.snapshot, position: { ...plan.snapshot.position, liquidity: "0" } },
    };
    const preview = await prepareApply(zero, agentWallet);
    assert.equal(preview.status, "blocked");
    assert.ok(preview.warnings.some((warning) => /could not build/iu.test(warning)));
  });

  it("blocks plans that require inventory prep", async () => {
    const shortfall: Plan = {
      ...plan,
      recommended: {
        ...plan.recommended,
        shortfall0: "1",
        prepAction: "Prep needed before execution: acquire WETH.",
      },
    };
    const preview = await prepareApply(shortfall, agentWallet);
    assert.equal(preview.status, "blocked");
    assert.ok(preview.warnings.some((warning) => /prep needed|inventory prep/iu.test(warning)));
  });
});
