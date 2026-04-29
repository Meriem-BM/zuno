import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Address, Position, Token } from "@zuno/core";
import { buildSnapshot, tickToPrice } from "@zuno/uniswap";
import {
  buildPlanDiff,
  critiqueWithContext,
  defaultRiskContext,
  proposeCandidates,
  recommendPlan,
  type RiskContext,
} from "../src/index.js";

describe("planner", () => {
  it("proposes reviewed candidates around the current tick", async () => {
    const snapshot = buildSnapshot(position("42", -199_400, -198_400, -198_330));
    const candidates = proposeCandidates(snapshot);
    assert.equal(candidates.length, 2);
    assert.ok(candidates.every((candidate) => candidate.tickLower < candidate.tickUpper));
    assert.equal(candidates[0]!.kind, "shift");
  });

  it("builds a plan and a structured before/after diff", async () => {
    const snapshot = buildSnapshot(position("42", -199_400, -198_400, -198_330));
    const plan = recommendPlan(snapshot);
    const diff = buildPlanDiff(plan);
    assert.match(plan.id, /^plan_/u);
    assert.equal(plan.positionId, snapshot.position.id);
    assert.equal(plan.risk.verdict, "approve_with_caution");
    assert.equal(diff.planId, plan.id);
    assert.equal(diff.oldRange.tickLower, snapshot.position.tickLower);
    assert.equal(diff.newRange.tickLower, plan.recommended.tickLower);
    assert.ok(diff.riskNote.length > 10);
  });
});

describe("planner — risk context drives the veto", () => {
  it("vetoes a tighter candidate when its buffer is below the floor", async () => {
    const snapshot = buildSnapshot(position("43", -198_900, -197_700, -198_330));
    const candidates = proposeCandidates(snapshot);
    const hostileVol: RiskContext = {
      realizedVolBps: 380,
      tickTravel24h: 1200,
      gasGwei: 35,
      feeYield24hUsd: 5.4,
      source: "test:hostile",
    };
    const result = critiqueWithContext(snapshot, candidates, hostileVol);
    assert.equal(result.recommended.kind, "widen");
    assert.equal(result.rejected?.kind, "tighten");
    assert.match(result.rejectReason ?? "", /buffer|36h|vol/iu);
    assert.match(result.rejectReason ?? "", /\d+/u);
  });

  it("the verdict reflects the buffer regime", async () => {
    const snapshot = buildSnapshot(position("43", -198_900, -197_700, -198_330));
    const candidates = proposeCandidates(snapshot);
    const calmVol: RiskContext = {
      realizedVolBps: 120,
      tickTravel24h: 80,
      gasGwei: 0.05,
      feeYield24hUsd: 8,
      source: "test:calm",
    };
    const result = critiqueWithContext(snapshot, candidates, calmVol);
    assert.equal(result.risk.verdict, "approve");
    assert.ok(result.risk.confidence >= 0.85, `expected ≥0.85 got ${result.risk.confidence}`);
  });

  it("risk reasons include the regime numbers it consulted", async () => {
    const snapshot = buildSnapshot(position("43", -198_900, -197_700, -198_330));
    const plan = recommendPlan(snapshot);
    const all = plan.risk.reasons.join(" ");
    assert.match(all, /bps|gwei|gas|buffer/iu);
    assert.match(all, /\d/u);
  });

  it("defaultRiskContext is deterministic across calls", async () => {
    const snapshot = buildSnapshot(position("42", -199_400, -198_400, -198_330));
    const a = defaultRiskContext(snapshot);
    const b = defaultRiskContext(snapshot);
    assert.deepEqual(a, b);
    assert.ok(a.realizedVolBps > 0);
    assert.ok(a.tickTravel24h > 0);
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
