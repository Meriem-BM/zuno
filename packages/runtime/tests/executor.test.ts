import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Address, Position, SessionState, Token } from "@zuno/core";
import type { Intent, IntentKind } from "@zuno/intents";
import { buildPlanDiff, recommendPlan } from "@zuno/planner";
import { createMemoryAlertStore, createMemoryPlanStore } from "@zuno/storage";
import { buildSnapshot, tickToPrice } from "@zuno/uniswap";
import { executeIntent } from "../src/executor/execute-intent.js";
import { TOOLS } from "../src/tools/index.js";
import type {
  ApplyPlanData,
  ConnectWalletData,
  InspectPositionData,
  RecommendRebalanceData,
  ToolDefinition,
  ToolRegistry,
} from "../src/contracts/types.js";

process.env.ZUNO_AXL_URL = "http://127.0.0.1:1";

const emptySession: SessionState = {
  watchAddress: null,
  walletAddress: null,
  chainId: null,
  lastPositionId: null,
  lastPlanId: null,
  lastIntent: null,
  signerMode: null,
};

const session = (patch: Partial<SessionState> = {}): SessionState => ({
  ...emptySession,
  ...patch,
});

const intent = (kind: IntentKind, fields: Partial<Intent> = {}): Intent => ({
  intent: kind,
  rawInput: kind,
  confidence: 0.9,
  ...fields,
});

const FIXTURE_ADDR = "0xabc1230000000000000000000000000000000def" as Address;
process.env.ZUNO_WATCH_ADDRESS = FIXTURE_ADDR;

const connectedSession = session({
  watchAddress: FIXTURE_ADDR,
  walletAddress: FIXTURE_ADDR,
  chainId: 42161,
  signerMode: "wallet",
});

const readOnlySession = session({
  watchAddress: FIXTURE_ADDR,
  chainId: 42161,
});

const ctx = (s: SessionState = emptySession) => ({
  session: s,
  tools: TEST_TOOLS,
  planStore: createMemoryPlanStore(),
});

async function ctxWithPlan(s: SessionState = connectedSession) {
  const plan = recommendPlan(buildSnapshot(position("42", -199_400, -198_400, -198_330)));
  const store = createMemoryPlanStore([plan]);
  return {
    context: { session: { ...s, lastPlanId: plan.id }, tools: TEST_TOOLS, planStore: store },
    plan,
  };
}

const TEST_TOOLS: ToolRegistry = [
  {
    name: "connectWallet",
    intents: ["connect_wallet"],
    execute: () => ({
      tool: "connectWallet",
      status: "success",
      message: "Read target configured.",
      data: {
        watchAddress: FIXTURE_ADDR,
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
    execute: (_intent, context) => ({
      tool: "showWatchTarget",
      status: "success",
      message: "Watching address.",
      data: {
        watchAddress: context.session.watchAddress,
        walletAddress: context.session.walletAddress,
        chainId: context.session.chainId,
        chainName: "Arbitrum",
        signerMode: context.session.signerMode,
        execution: "read_only",
      },
    }),
  },
  {
    name: "showWalletBalance",
    intents: ["show_balance"],
    execute: (_intent, context) =>
      context.session.watchAddress
        ? {
            tool: "showWalletBalance",
            status: "error",
            message: "Token balance reads are not enabled yet.",
            errorCode: "EXECUTION_NOT_AVAILABLE",
          }
        : {
            tool: "showWalletBalance",
            status: "error",
            message: "No watch address configured.",
            errorCode: "WATCH_ADDRESS_NOT_SET",
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
  {
    name: "listWalletPositions",
    intents: ["list_positions"],
    execute: (intent) => ({
      tool: "listWalletPositions",
      status: "success",
      message: "Loaded positions.",
      data: {
        watchAddress: intent.walletAddress ?? FIXTURE_ADDR,
        walletAddress: intent.walletAddress ?? FIXTURE_ADDR,
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
    intents: ["inspect_position", "check_range_status"],
    execute: (intent, context) => {
      const positionId = intent.positionId ?? context.session.lastPositionId;
      if (!positionId) {
        return {
          tool: "inspectPosition",
          status: "error",
          message: "No position id.",
          errorCode: "POSITION_NOT_FOUND",
        };
      }
      return {
        tool: "inspectPosition",
        status: "success",
        message: "Position loaded.",
        data: inspectData(positionId),
      };
    },
  },
  {
    name: "inspectAllPositions",
    intents: ["inspect_all_positions"],
    execute: () => ({
      tool: "inspectAllPositions",
      status: "success",
      message: "Positions inspected.",
      data: { positions: [inspectData("42"), inspectData("43")] },
    }),
  },
  {
    name: "listOutOfRangePositions",
    intents: ["list_out_of_range_positions"],
    execute: () => ({
      tool: "listOutOfRangePositions",
      status: "success",
      message: "Out-of-range positions loaded.",
      data: { positions: [inspectData("42")] },
    }),
  },
  {
    name: "listRiskyPositions",
    intents: ["list_risky_positions"],
    execute: () => ({
      tool: "listRiskyPositions",
      status: "success",
      message: "Risky positions loaded.",
      data: { positions: [inspectData("42")] },
    }),
  },
  {
    name: "recommendRebalance",
    intents: ["recommend_rebalance"],
    execute: async (intent, context) => {
      const positionId = intent.positionId ?? context.session.lastPositionId ?? "42";
      const plan = recommendPlan(buildSnapshot(position(positionId, -199_400, -198_400, -198_330)));
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
    name: "showRebalanceOptions",
    intents: ["show_rebalance_options"],
    execute: () => ({
      tool: "showRebalanceOptions",
      status: "success",
      message: "Options loaded.",
      data: { options: [] },
    }),
  },
  {
    name: "explainRecommendation",
    intents: ["explain_recommendation"],
    execute: () => ({
      tool: "explainRecommendation",
      status: "success",
      message: "Recommendation explained.",
      data: { reasons: ["range buffer reviewed"] },
    }),
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
              summary: "Approve with wallet.",
              pair: "WETH/USDC",
              feeTier: 500,
              oldRange: { priceLower: 1, priceUpper: 2 },
              newRange: { priceLower: 1, priceUpper: 3 },
              residual: { token0: "0", token1: "0" },
              estimatedGas: "0",
              estimatedGasUsd: 0,
              estimatedSlippage: 0,
              verdict: plan.risk.verdict,
              confidence: plan.risk.confidence,
              reasons: plan.risk.reasons,
              warnings: [],
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
    name: "showAgentStatus",
    intents: ["agent_status"],
    execute: () => ({
      tool: "showAgentStatus",
      status: "success",
      message: "Agent status loaded.",
      data: {},
    }),
  },
  {
    name: "showPeers",
    intents: ["show_peers"],
    execute: () => ({
      tool: "showPeers",
      status: "success",
      message: "Peers loaded.",
      data: { peers: [] },
    }),
  },
  {
    name: "showLogs",
    intents: ["show_logs"],
    execute: () => ({
      tool: "showLogs",
      status: "error",
      message: "Agent log streaming is not configured.",
      errorCode: "EXECUTION_NOT_AVAILABLE",
    }),
  },
  {
    name: "monitorWallet",
    intents: ["monitor_wallet"],
    execute: () => ({
      tool: "monitorWallet",
      status: "success",
      message: "Monitor configured.",
      data: { command: "pnpm monitor", status: "configured" },
    }),
  },
  {
    name: "showAlerts",
    intents: ["show_alerts"],
    execute: async (_intent, context) => ({
      tool: "showAlerts",
      status: "success",
      message: "Alerts loaded.",
      data: { alerts: (await context.alertStore?.list()) ?? [] },
    }),
  },
];

describe("executeIntent — intent-to-tool mapping", () => {
  it("maps every actionable intent to exactly one tool", () => {
    const actionable: IntentKind[] = [
      "connect_wallet",
      "show_watch_target",
      "show_balance",
      "create_position",
      "swap_tokens",
      "list_positions",
      "inspect_position",
      "inspect_all_positions",
      "check_range_status",
      "list_out_of_range_positions",
      "list_risky_positions",
      "recommend_rebalance",
      "show_rebalance_options",
      "explain_recommendation",
      "show_diff",
      "simulate_plan",
      "apply_plan",
      "agent_status",
      "show_peers",
      "show_logs",
      "monitor_wallet",
      "show_alerts",
    ];
    for (const kind of actionable) {
      const matches = TOOLS.filter((t) => t.intents.includes(kind));
      assert.equal(matches.length, 1, `intent ${kind} → ${matches.length} tools`);
    }
  });

  it("does not register tools for non-actionable intents", () => {
    const nonActionable: IntentKind[] = ["exit", "help", "unknown", "needs_clarification"];
    for (const kind of nonActionable) {
      const matches = TOOLS.filter((t) => t.intents.includes(kind));
      assert.equal(matches.length, 0, `intent ${kind} → ${matches.length} tools (expected 0)`);
    }
  });
});

describe("executeIntent — non-actionable intents", () => {
  it("returns INTENT_NOT_ACTIONABLE for help / exit / unknown / needs_clarification", async () => {
    for (const kind of ["help", "exit", "unknown", "needs_clarification"] as const) {
      const { result, session: next } = await executeIntent(intent(kind), ctx());
      assert.equal(result.status, "error");
      assert.equal(result.errorCode, "INTENT_NOT_ACTIONABLE");
      assert.equal(next.lastIntent, null, "session must not be touched");
    }
  });
});

describe("executeIntent — successful execution", () => {
  it("connect_wallet returns wallet data and updates session", async () => {
    const { result, session: next } = await executeIntent(intent("connect_wallet"), ctx());
    assert.equal(result.status, "success");
    assert.equal(result.tool, "connectWallet");
    const data = result.data as ConnectWalletData;
    assert.match(data.watchAddress, /^0x[a-f0-9]{40}$/iu);
    assert.equal(data.walletAddress, null);
    assert.equal(next.watchAddress, data.watchAddress);
    assert.equal(next.walletAddress, null);
    assert.equal(next.chainId, data.chainId);
    assert.equal(next.signerMode, null);
    assert.equal(next.lastIntent, "connect_wallet");
  });

  it("show_watch_target returns the current read target", async () => {
    const { result, session: next } = await executeIntent(
      intent("show_watch_target"),
      ctx(readOnlySession),
    );
    assert.equal(result.status, "success");
    assert.equal(result.tool, "showWatchTarget");
    const data = result.data as { watchAddress: string; chainName: string };
    assert.equal(data.watchAddress, FIXTURE_ADDR);
    assert.equal(data.chainName, "Arbitrum");
    assert.equal(next.chainId, 42161);
  });

  it("inspect_position returns the position and sets lastPositionId", async () => {
    const { result, session: next } = await executeIntent(
      intent("inspect_position", { positionId: "42" }),
      ctx(readOnlySession),
    );
    assert.equal(result.status, "success");
    const data = result.data as InspectPositionData;
    assert.equal(data.positionId, "42");
    assert.equal(next.lastPositionId, "42");
    assert.equal(next.lastIntent, "inspect_position");
  });

  it("recommend_rebalance produces a planId and writes it to session", async () => {
    const { result, session: next } = await executeIntent(
      intent("recommend_rebalance", { positionId: "43" }),
      ctx(readOnlySession),
    );
    assert.equal(result.status, "success");
    const data = result.data as RecommendRebalanceData;
    assert.match(data.planId, /^plan_/);
    assert.equal(next.lastPlanId, data.planId);
    assert.equal(next.lastPositionId, "43");
  });

  it("apply_plan with planId + signerMode prepares wallet signing and updates session", async () => {
    const { context, plan } = await ctxWithPlan();
    const { result, session: next } = await executeIntent(
      intent("apply_plan", { planId: plan.id, signerMode: "wallet" }),
      context,
    );
    assert.equal(result.status, "success");
    const data = result.data as ApplyPlanData;
    assert.equal(data.planId, plan.id);
    assert.equal(data.signerMode, "wallet");
    assert.equal(data.status, "requires_wallet_signature");
    assert.match(data.summary, /wallet/iu);
    assert.equal(next.lastPlanId, plan.id);
    assert.equal(next.signerMode, "wallet");
  });

  it("list_positions works in read-only mode from watchAddress", async () => {
    const { result, session: next } = await executeIntent(
      intent("list_positions"),
      ctx(readOnlySession),
    );
    assert.equal(result.status, "success");
    assert.equal(result.tool, "listWalletPositions");
    const data = result.data as { positions: unknown[] };
    assert.equal(data.positions.length, 2);
    assert.equal(next.walletAddress, null);
    assert.equal(next.chainId, 42161);
  });

  it("monitor_wallet returns the background monitor command", async () => {
    const { result } = await executeIntent(intent("monitor_wallet"), ctx(readOnlySession));
    assert.equal(result.status, "success");
    assert.equal(result.tool, "monitorWallet");
    const data = result.data as { command: string; status: string };
    assert.equal(data.command, "pnpm monitor");
    assert.equal(data.status, "configured");
  });

  it("show_alerts returns a structured alert list", async () => {
    const alertStore = createMemoryAlertStore([
      {
        id: "alert_test",
        walletAddress: FIXTURE_ADDR,
        chainId: 42161,
        positionId: "42",
        severity: "critical",
        kind: "out_of_range",
        message: "position out of range",
        reason: "out of range",
        createdAt: 1,
      },
    ]);
    const { result } = await executeIntent(intent("show_alerts"), {
      session: connectedSession,
      tools: TEST_TOOLS,
      planStore: createMemoryPlanStore(),
      alertStore,
    });
    assert.equal(result.status, "success");
    assert.equal(result.tool, "showAlerts");
    const data = result.data as { alerts: unknown[] };
    assert.equal(data.alerts.length, 1);
  });
});

describe("executeIntent — fallback to session state", () => {
  it("inspect_position falls back to session.lastPositionId", async () => {
    const { result, session: next } = await executeIntent(
      intent("inspect_position"),
      ctx(session({ ...connectedSession, lastPositionId: "42" })),
    );
    assert.equal(result.status, "success");
    const data = result.data as InspectPositionData;
    assert.equal(data.positionId, "42");
    assert.equal(next.lastPositionId, "42");
  });

  it("show_diff falls back to session.lastPlanId", async () => {
    const { context, plan } = await ctxWithPlan();
    const { result, session: next } = await executeIntent(intent("show_diff"), context);
    assert.equal(result.status, "success");
    const data = result.data as { planId: string };
    assert.equal(data.planId, plan.id);
    assert.equal(next.lastPlanId, plan.id);
  });

  it("simulate_plan falls back to session.lastPlanId", async () => {
    const { context } = await ctxWithPlan();
    const { result } = await executeIntent(intent("simulate_plan"), context);
    assert.equal(result.status, "success");
  });

  it("apply_plan with session plan but no signer defaults to wallet approval path", async () => {
    const { context } = await ctxWithPlan(readOnlySession);
    const { result } = await executeIntent(intent("apply_plan"), context);
    assert.equal(result.status, "success");
    const data = result.data as ApplyPlanData;
    assert.equal(data.signerMode, "wallet");
    assert.equal(data.approval.kind, "walletconnect_qr");
  });
});

describe("executeIntent — error cases", () => {
  it("inspect_position with no id and no session → POSITION_NOT_FOUND", async () => {
    const { result, session: next } = await executeIntent(intent("inspect_position"), ctx());
    assert.equal(result.status, "error");
    assert.equal(result.errorCode, "POSITION_NOT_FOUND");
    assert.equal(next.lastPositionId, null);
    assert.equal(next.lastIntent, null, "no session writes on failure");
  });

  it("show_diff without plan returns PLAN_NOT_FOUND", async () => {
    const { result } = await executeIntent(intent("show_diff"), ctx());
    assert.equal(result.status, "error");
    assert.equal(result.errorCode, "PLAN_NOT_FOUND");
  });

  it("apply_plan without plan returns PLAN_NOT_FOUND", async () => {
    const { result } = await executeIntent(intent("apply_plan", { signerMode: "wallet" }), ctx());
    assert.equal(result.status, "error");
    assert.equal(result.errorCode, "PLAN_NOT_FOUND");
  });

  it("show_balance without a watch address returns WATCH_ADDRESS_NOT_SET", async () => {
    const previousWatch = process.env.ZUNO_WATCH_ADDRESS;
    const previousWallet = process.env.ZUNO_WALLET_ADDRESS;
    delete process.env.ZUNO_WATCH_ADDRESS;
    delete process.env.ZUNO_WALLET_ADDRESS;
    try {
      const { result } = await executeIntent(intent("show_balance"), ctx());
      assert.equal(result.status, "error");
      assert.equal(result.errorCode, "WATCH_ADDRESS_NOT_SET");
    } finally {
      if (previousWatch) process.env.ZUNO_WATCH_ADDRESS = previousWatch;
      if (previousWallet) process.env.ZUNO_WALLET_ADDRESS = previousWallet;
    }
  });

  it("list_positions can take the read target from the intent address", async () => {
    const { result, session: next } = await executeIntent(
      intent("list_positions", { walletAddress: FIXTURE_ADDR }),
      ctx(),
    );
    assert.equal(result.status, "success");
    assert.equal(next.watchAddress, FIXTURE_ADDR);
    assert.equal(next.walletAddress, null);
  });

  it("stores a pasted watch address even when the read tool fails", async () => {
    const failing: ToolDefinition = {
      name: "listWalletPositions",
      intents: ["list_positions"],
      execute() {
        return {
          tool: "listWalletPositions",
          status: "error",
          message: "rpc unavailable",
          errorCode: "CHAIN_READ_FAILED",
        };
      },
    };
    const { result, session: next } = await executeIntent(
      intent("list_positions", { walletAddress: FIXTURE_ADDR }),
      { session: emptySession, tools: [failing] },
    );
    assert.equal(result.status, "error");
    assert.equal(next.watchAddress, FIXTURE_ADDR);
    assert.equal(next.lastIntent, "list_positions");
  });

  it("returns TOOL_NOT_MAPPED if the registry is empty", async () => {
    const { result } = await executeIntent(intent("list_positions"), {
      session: emptySession,
      tools: [],
    });
    assert.equal(result.status, "error");
    assert.equal(result.errorCode, "TOOL_NOT_MAPPED");
  });

  it("returns TOOL_EXECUTION_FAILED when a tool throws", async () => {
    const exploding: ToolDefinition = {
      name: "listWalletPositions",
      intents: ["list_positions"],
      execute() {
        throw new Error("boom");
      },
    };
    const { result, session: next } = await executeIntent(intent("list_positions"), {
      session: emptySession,
      tools: [exploding],
    });
    assert.equal(result.status, "error");
    assert.equal(result.errorCode, "TOOL_EXECUTION_FAILED");
    assert.match(result.message, /boom/);
    assert.equal(next.lastIntent, null);
  });
});

describe("executeIntent — session immutability", () => {
  it("returns a new session object on success rather than mutating the input", async () => {
    const before = session({ lastPositionId: "old" });
    const { session: next } = await executeIntent(
      intent("inspect_position", { positionId: "42" }),
      ctx({ ...before, watchAddress: FIXTURE_ADDR, chainId: 42161 }),
    );
    assert.equal(before.lastPositionId, "old", "input snapshot must not be mutated");
    assert.equal(next.lastPositionId, "42");
    assert.notEqual(before, next);
  });
});

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

function inspectData(positionId: string): InspectPositionData {
  const snapshot = buildSnapshot(position(positionId, -199_400, -198_400, -198_330));
  return {
    positionId,
    pair: "WETH/USDC",
    feeTier: 500,
    rangeStatus: snapshot.range.inRange ? "IN_RANGE" : "OUT_OF_RANGE",
    priceLower: snapshot.range.priceLower,
    priceUpper: snapshot.range.priceUpper,
    priceCurrent: snapshot.range.priceCurrent,
    liquidity: snapshot.position.liquidity,
    utilization: snapshot.range.utilization,
  };
}

function position(id: string, tickLower: number, tickUpper: number, currentTick: number): Position {
  return {
    id,
    owner: FIXTURE_ADDR,
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
    tickLower,
    tickUpper,
    liquidity: "5840291203487120349",
    amount0: "418000000000000000",
    amount1: "0",
    feesOwed0: "8200000000000000",
    feesOwed1: "12400000",
  };
}
