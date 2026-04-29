import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  createSession,
  type Address,
  type Position,
  type SessionState,
  type Token,
} from "@zuno/core";
import { buildPlanDiff, recommendPlan } from "@zuno/planner";
import { createMemoryPlanStore } from "@zuno/storage";
import { buildSnapshot, tickToPrice } from "@zuno/uniswap";
import type { ToolRegistry } from "@zuno/runtime";
import { runIntent } from "../src/shell/run-intent.js";

process.env.ZUNO_AXL_URL = "http://127.0.0.1:1";
process.env.ZUNO_PLAN_DIR = join(tmpdir(), `zuno-test-plans-${process.pid}`);

const emptySession: SessionState = {
  watchAddress: null,
  walletAddress: null,
  chainId: null,
  lastPositionId: null,
  lastPlanId: null,
  lastIntent: null,
  signerMode: null,
};

const testWallet = "0xabc1230000000000000000000000000000000def" as Address;
process.env.ZUNO_WATCH_ADDRESS = testWallet;
const planStore = createMemoryPlanStore();

const runTurn = (text: string, session: SessionState) =>
  runIntent(text, session, { tools: TEST_TOOLS, planStore });

const connectedSession: SessionState = {
  ...emptySession,
  watchAddress: testWallet,
  walletAddress: testWallet,
  chainId: 42161,
  signerMode: "wallet",
};

describe("session — boot state", () => {
  it("createSession() starts with every field null", () => {
    const session = createSession().get();
    assert.deepEqual(session, emptySession);
  });
});

describe("runIntent — shell-level intents do not touch the runtime", () => {
  it("help returns no result and bumps lastIntent", async () => {
    const run = await runTurn("help", emptySession);
    assert.equal(run.intent.intent, "help");
    assert.equal(run.result, undefined);
    assert.equal(run.session.lastIntent, "help");
  });

  it("exit returns no result and bumps lastIntent", async () => {
    const run = await runTurn("quit", emptySession);
    assert.equal(run.intent.intent, "exit");
    assert.equal(run.result, undefined);
    assert.equal(run.session.lastIntent, "exit");
  });

  it("gibberish becomes needs_clarification, not a runtime call", async () => {
    const run = await runTurn("xyzzy frobnicate", emptySession);
    assert.equal(run.intent.intent, "needs_clarification");
    assert.equal(run.result, undefined);
    assert.match(run.intent.clarification ?? "", /try/iu);
  });
});

describe("runIntent — actionable intents go through the runtime", () => {
  it("inspect_position with id returns a result and updates session", async () => {
    const run = await runTurn("inspect position 42", {
      ...emptySession,
      watchAddress: testWallet,
      chainId: 42161,
    });
    assert.equal(run.intent.intent, "inspect_position");
    assert.ok(run.result, "expected a runtime result");
    assert.equal(run.result?.tool, "inspectPosition");
    assert.equal(run.result?.status, "success");
    assert.equal(run.session.lastPositionId, "42");
    assert.equal(run.session.lastIntent, "inspect_position");
  });

  it("connect_wallet adopts wallet fields from the runtime outcome", async () => {
    const run = await runTurn("connect my wallet", emptySession);
    assert.equal(run.result?.tool, "connectWallet");
    assert.equal(run.result?.status, "success");
    assert.match(run.session.watchAddress ?? "", /^0x[a-f0-9]{40}$/iu);
    assert.equal(run.session.walletAddress, null);
    assert.equal(run.session.signerMode, null);
  });

  it("show positions for an address sets read-only watch target without wallet connection", async () => {
    const run = await runTurn(`show positions for ${testWallet}`, emptySession);
    assert.equal(run.intent.intent, "list_positions");
    assert.equal(run.result?.tool, "listWalletPositions");
    assert.equal(run.result?.status, "success");
    assert.equal(run.session.watchAddress, testWallet.toLowerCase());
    assert.equal(run.session.walletAddress, null);
  });

  it("a bare address starts read-only position analysis", async () => {
    const run = await runTurn(testWallet, emptySession);
    assert.equal(run.intent.intent, "list_positions");
    assert.equal(run.result?.tool, "listWalletPositions");
    assert.equal(run.result?.status, "success");
    assert.equal(run.session.watchAddress, testWallet.toLowerCase());
    assert.equal(run.session.chainId, 42161);
  });

  it("what's my wallet address shows the watch target, not token balance", async () => {
    const run = await runTurn("what's my wallet address", {
      ...emptySession,
      watchAddress: testWallet,
      chainId: 42161,
    });
    assert.equal(run.intent.intent, "show_watch_target");
    assert.equal(run.result?.tool, "showWatchTarget");
    assert.equal(run.result?.status, "success");
  });

  it("my wallet address also shows the watch target", async () => {
    const run = await runTurn("my wallet address", {
      ...emptySession,
      watchAddress: testWallet,
      chainId: 42161,
    });
    assert.equal(run.intent.intent, "show_watch_target");
    assert.equal(run.result?.tool, "showWatchTarget");
    assert.equal(run.result?.status, "success");
  });

  it("filler text plus wallet address starts read-only analysis", async () => {
    const run = await runTurn(`here my wallet ${testWallet}`, emptySession);
    assert.equal(run.intent.intent, "list_positions");
    assert.equal(run.result?.tool, "listWalletPositions");
    assert.equal(run.result?.status, "success");
    assert.equal(run.session.watchAddress, testWallet.toLowerCase());
  });

  it("create position returns a specific product-boundary message", async () => {
    const run = await runTurn("create position", emptySession);
    assert.equal(run.intent.intent, "create_position");
    assert.equal(run.result?.tool, "createPosition");
    assert.equal(run.result?.status, "error");
    assert.match(run.result?.message ?? "", /does not create/iu);
  });

  it("standalone swaps return a specific product-boundary message", async () => {
    const run = await runTurn("need t swap some eth to usdc", emptySession);
    assert.equal(run.intent.intent, "swap_tokens");
    assert.equal(run.result?.tool, "swapTokens");
    assert.equal(run.result?.status, "error");
    assert.match(run.result?.message ?? "", /standalone swaps/iu);
  });

  it("can you look at my LPs lists positions", async () => {
    const run = await runTurn("can you look at my LPs", {
      ...emptySession,
      watchAddress: testWallet,
      chainId: 42161,
    });
    assert.equal(run.intent.intent, "list_positions");
    assert.equal(run.result?.tool, "listWalletPositions");
    assert.equal(run.result?.status, "success");
  });

  it("'I pasted my wallet' reuses the watch address", async () => {
    const run = await runTurn("I pasted my wallet", {
      ...emptySession,
      watchAddress: testWallet,
      chainId: 42161,
    });
    assert.equal(run.intent.intent, "list_positions");
    assert.equal(run.result?.status, "success");
  });

  it("recommend_rebalance writes the new planId to session", async () => {
    const run = await runTurn("recommend what I should do with position 43", connectedSession);
    assert.equal(run.result?.tool, "recommendRebalance");
    assert.equal(run.result?.status, "success");
    assert.match(run.session.lastPlanId ?? "", /^plan_/u);
  });

  it("show_diff falls through session.lastPlanId via the runtime", async () => {
    const recommended = await runTurn(
      "recommend what I should do with position 42",
      connectedSession,
    );
    const run = await runTurn("show me the diff", recommended.session);
    assert.equal(run.result?.tool, "showPlanDiff");
    assert.equal(run.result?.status, "success");
    assert.equal(run.session.lastPlanId, recommended.session.lastPlanId);
  });
});

describe("runIntent — runtime errors are preserved on the result", () => {
  it("apply_plan with no plan returns a structured error", async () => {
    const run = await runTurn("apply plan_abc", emptySession);
    assert.equal(run.intent.intent, "apply_plan");
    assert.equal(run.result?.status, "error");
    assert.equal(run.result?.errorCode, "PLAN_NOT_FOUND");
  });

  it("apply_plan with plan succeeds without pre-connected wallet", async () => {
    const recommended = await runTurn(
      "recommend what I should do with position 42",
      connectedSession,
    );
    const run = await runTurn("apply it", {
      ...recommended.session,
      walletAddress: null,
      signerMode: null,
    });
    assert.equal(run.intent.intent, "apply_plan");
    assert.equal(run.result?.tool, "applyPlan");
    assert.equal(run.result?.status, "success");
    assert.equal(run.session.lastPlanId, recommended.session.lastPlanId);
    assert.equal(run.session.signerMode, null);
  });
});

describe("runIntent — multi-turn continuity", () => {
  it("threads a session across inspect → recommend → diff → simulate → apply", async () => {
    let session = connectedSession;

    const r1 = await runTurn("inspect position 42", session);
    assert.equal(r1.intent.intent, "inspect_position");
    assert.equal(r1.session.lastPositionId, "42");
    session = r1.session;

    const r2 = await runTurn("recommend what I should do with this position", session);
    assert.equal(r2.intent.intent, "recommend_rebalance");
    assert.equal(r2.intent.positionId, "42");
    assert.equal(r2.result?.tool, "recommendRebalance");
    assert.match(r2.session.lastPlanId ?? "", /^plan_/u);
    const planId = r2.session.lastPlanId!;
    session = r2.session;

    const r3 = await runTurn("show me the diff", session);
    assert.equal(r3.intent.intent, "show_diff");
    assert.equal(r3.result?.tool, "showPlanDiff");
    assert.equal(r3.session.lastPlanId, planId);
    session = r3.session;

    const r4 = await runTurn("simulate it", session);
    assert.equal(r4.intent.intent, "simulate_plan");
    assert.equal(r4.result?.tool, "simulatePlan");
    assert.equal(r4.session.lastPlanId, planId);
    session = r4.session;

    const r5 = await runTurn("apply it with my wallet", session);
    assert.equal(r5.intent.intent, "apply_plan");
    assert.equal(r5.result?.tool, "applyPlan");
    assert.equal(r5.result?.status, "success");
    assert.equal(r5.session.lastPlanId, planId);
    assert.equal(r5.session.signerMode, "wallet");
  });

  it("keeps session stable when a turn fails to resolve a reference", async () => {
    const before: SessionState = { ...emptySession };
    const run = await runTurn("inspect", before);
    assert.equal(run.intent.intent, "needs_clarification");
    assert.equal(run.result, undefined);
    assert.equal(run.session.lastPositionId, null);
    assert.equal(run.session.lastPlanId, null);
    assert.equal(run.session.lastIntent, "needs_clarification");
  });
});

const TEST_TOOLS: ToolRegistry = [
  {
    name: "connectWallet",
    intents: ["connect_wallet"],
    execute: () => ({
      tool: "connectWallet",
      status: "success",
      message: "Read target configured.",
      data: {
        watchAddress: testWallet,
        walletAddress: null,
        chainId: 42161,
        chainName: "Arbitrum",
        signerMode: null,
      },
    }),
  },
  {
    name: "showWatchTarget",
    intents: ["show_watch_target"],
    execute: (intent, context) => ({
      tool: "showWatchTarget",
      status: "success",
      message: "Watch target loaded.",
      data: {
        watchAddress: intent.walletAddress ?? context.session.watchAddress,
        walletAddress: context.session.walletAddress,
        chainId: context.session.chainId ?? 42161,
        chainName: "Arbitrum",
        signerMode: context.session.signerMode,
        execution: "read_only",
      },
    }),
  },
  {
    name: "listWalletPositions",
    intents: ["list_positions"],
    execute: (intent) => ({
      tool: "listWalletPositions",
      status: "success",
      message: "Loaded positions.",
      data: {
        watchAddress: intent.walletAddress ?? testWallet,
        walletAddress: intent.walletAddress ?? testWallet,
        chainId: 42161,
        positions: [
          { positionId: "42", pair: "WETH/USDC", feeTier: 500 },
          { positionId: "43", pair: "WETH/USDC", feeTier: 500 },
        ],
      },
    }),
  },
  {
    name: "inspectPosition",
    intents: ["inspect_position"],
    execute: (intent, context) => {
      const positionId = intent.positionId ?? context.session.lastPositionId ?? "42";
      return {
        tool: "inspectPosition",
        status: "success",
        message: "Position loaded.",
        data: inspectData(positionId),
      };
    },
  },
  {
    name: "recommendRebalance",
    intents: ["recommend_rebalance"],
    execute: async (intent, context) => {
      const positionId = intent.positionId ?? context.session.lastPositionId ?? "42";
      const plan = recommendPlan(buildSnapshot(position(positionId)));
      await context.planStore?.save(plan);
      return {
        tool: "recommendRebalance",
        status: "success",
        message: "Plan stored.",
        data: {
          planId: plan.id,
          positionId,
          recommended: plan.recommended,
          rejected: plan.rejected,
          rejectReason: plan.rejectReason,
          reason: plan.recommended.rationale,
          verdict: plan.risk.verdict,
          confidence: plan.risk.confidence,
        },
      };
    },
  },
  {
    name: "showPlanDiff",
    intents: ["show_diff"],
    execute: async (intent, context) => {
      const planId = intent.planId ?? context.session.lastPlanId;
      const plan = planId ? await context.planStore?.get(planId) : null;
      return plan
        ? {
            tool: "showPlanDiff",
            status: "success",
            message: "Diff loaded.",
            data: buildPlanDiff(plan),
          }
        : {
            tool: "showPlanDiff",
            status: "error",
            message: "Plan was not found.",
            errorCode: "PLAN_NOT_FOUND",
          };
    },
  },
  {
    name: "simulatePlan",
    intents: ["simulate_plan"],
    execute: async (intent, context) => {
      const planId = intent.planId ?? context.session.lastPlanId;
      const plan = planId ? await context.planStore?.get(planId) : null;
      return plan
        ? {
            tool: "simulatePlan",
            status: "success",
            message: "Simulation ready.",
            data: { planId: plan.id },
          }
        : {
            tool: "simulatePlan",
            status: "error",
            message: "Plan was not found.",
            errorCode: "PLAN_NOT_FOUND",
          };
    },
  },
  {
    name: "applyPlan",
    intents: ["apply_plan"],
    execute: async (intent, context) => {
      const planId = intent.planId ?? context.session.lastPlanId;
      const plan = planId ? await context.planStore?.get(planId) : null;
      return plan
        ? {
            tool: "applyPlan",
            status: "success",
            message: "Wallet approval required.",
            data: {
              planId: plan.id,
              positionId: plan.positionId,
              signerMode: intent.signerMode ?? "wallet",
              status: "requires_wallet_signature",
              approval: {
                kind: "walletconnect_qr",
                status: "requires_project_id",
                uri: null,
                instructions: [],
              },
            },
          }
        : {
            tool: "applyPlan",
            status: "error",
            message: "Plan was not found.",
            errorCode: "PLAN_NOT_FOUND",
          };
    },
  },
  {
    name: "createPosition",
    intents: ["create_position"],
    execute: () => ({
      tool: "createPosition",
      status: "error",
      message: "Zuno does not create brand-new LP positions yet.",
      errorCode: "EXECUTION_NOT_AVAILABLE",
    }),
  },
  {
    name: "swapTokens",
    intents: ["swap_tokens"],
    execute: () => ({
      tool: "swapTokens",
      status: "error",
      message: "Zuno does not run standalone swaps.",
      errorCode: "EXECUTION_NOT_AVAILABLE",
    }),
  },
];

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

function inspectData(positionId: string) {
  const snapshot = buildSnapshot(position(positionId));
  return {
    positionId,
    pair: "WETH/USDC",
    feeTier: 500,
    rangeStatus: snapshot.range.inRange ? "IN_RANGE" : "OUT_OF_RANGE",
    priceLower: snapshot.range.priceLower,
    priceUpper: snapshot.range.priceUpper,
    priceCurrent: snapshot.range.priceCurrent,
  };
}

function position(id: string): Position {
  const currentTick = -198_330;
  return {
    id,
    owner: testWallet,
    pool: {
      address: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
      chainId: 42161,
      token0,
      token1,
      feeTier: 500,
      tickSpacing: 10,
      currentTick,
      sqrtPriceX96: "0",
      liquidity: "12345678901234567890",
      price: tickToPrice(currentTick, token0.decimals, token1.decimals),
    },
    tickLower: -199_400,
    tickUpper: -198_400,
    liquidity: "5840291203487120349",
    amount0: "418000000000000000",
    amount1: "0",
    feesOwed0: "8200000000000000",
    feesOwed1: "12400000",
  };
}
