import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSession, type Address, type Hex, type Position, type SessionState } from "@zuno/core";
import { buildPlanDiff, recommendPlan } from "@zuno/strategy/planner";
import { createMemoryPlanStore } from "@zuno/storage";
import { buildSnapshot, tickToPrice } from "@zuno/chain/uniswap";
import type { ToolRegistry } from "@zuno/runtime";
import { runIntent } from "../src/shell/run-intent.js";

process.env.ZUNO_AXL_CLI_API_URL = "http://127.0.0.1:1";
process.env.ZUNO_AXL_CLI_PEER_ID ??= "0".repeat(64);
process.env.ZUNO_AXL_SCOUT_PEER_ID ??= "1".repeat(64);
process.env.ZUNO_AXL_STRATEGIST_PEER_ID ??= "2".repeat(64);
process.env.ZUNO_AXL_CRITIC_PEER_ID ??= "3".repeat(64);
process.env.ZUNO_AXL_ARBITER_PEER_ID ??= "4".repeat(64);

const agentWallet = "0xabc1230000000000000000000000000000000def" as Address;
const emptySession: SessionState = {
  userWalletAddress: null,
  agentWalletAddress: null,
  chainId: null,
  lastPositionId: null,
  lastPlanId: null,
  lastActionId: null,
  lastIntent: null,
  approvalState: "idle",
  executionState: "idle",
};

const planStore = createMemoryPlanStore();
const runTurn = (text: string, session: SessionState) =>
  runIntent(text, session, { tools: TEST_TOOLS, planStore });

describe("runIntent shell state", () => {
  it("createSession starts with the Turnkey agent-wallet model", () => {
    assert.deepEqual(createSession().get(), emptySession);
  });

  it("handles shell-level help without runtime execution", async () => {
    const run = await runTurn("help", emptySession);
    assert.equal(run.intent.intent, "help");
    assert.equal(run.result, undefined);
    assert.equal(run.session.lastIntent, "help");
  });

  it("does not treat a bare wallet address as the main product path", async () => {
    const run = await runTurn("0xabcdef0123456789abcdef0123456789abcdef01", emptySession);
    assert.equal(run.intent.intent, "needs_clarification");
    assert.equal(run.result, undefined);
    assert.equal(run.session.agentWalletAddress, null);
  });
});

describe("runIntent agent wallet lifecycle", () => {
  it("creates the Zuno wallet and stores it in session", async () => {
    const run = await runTurn("create my zuno wallet", emptySession);
    assert.equal(run.intent.intent, "create_agent_wallet");
    assert.equal(run.result?.tool, "createAgentWallet");
    assert.equal(run.result?.status, "success");
    assert.equal(run.session.agentWalletAddress, agentWallet);
    assert.equal(run.session.chainId, 8453);
  });

  it("shows the current Zuno wallet", async () => {
    const run = await runTurn("show my zuno wallet", sessionWithWallet());
    assert.equal(run.intent.intent, "show_agent_wallet");
    assert.equal(run.result?.tool, "showAgentWallet");
    assert.equal(run.result?.status, "success");
  });

  it("shows Zuno wallet balance and funding guidance", async () => {
    const balance = await runTurn("what's my zuno wallet balance", sessionWithWallet());
    assert.equal(balance.result?.tool, "showAgentWalletBalance");
    assert.equal(balance.result?.status, "success");

    const fund = await runTurn("fund my zuno wallet", sessionWithWallet());
    assert.equal(fund.result?.tool, "fundAgentWallet");
    assert.equal(fund.result?.status, "success");
  });
});

describe("runIntent LP workflow", () => {
  it("lists positions for the Zuno wallet", async () => {
    const run = await runTurn("inspect my positions", sessionWithWallet());
    assert.equal(run.intent.intent, "list_positions");
    assert.equal(run.result?.tool, "listAgentWalletPositions");
    assert.equal(run.result?.status, "success");
  });

  it("threads inspect, recommend, diff, simulate, approve, apply", async () => {
    let current = sessionWithWallet();

    const inspected = await runTurn("inspect position 42", current);
    assert.equal(inspected.result?.tool, "inspectPosition");
    assert.equal(inspected.session.lastPositionId, "42");
    current = inspected.session;

    const recommended = await runTurn("recommend what I should do with this position", current);
    assert.equal(recommended.result?.tool, "recommendRebalance");
    assert.match(recommended.session.lastPlanId ?? "", /^plan_/u);
    assert.equal(recommended.session.executionState, "drafted");
    current = recommended.session;

    const diff = await runTurn("show me the diff", current);
    assert.equal(diff.result?.tool, "showPlanDiff");
    assert.equal(diff.result?.status, "success");
    current = diff.session;

    const simulated = await runTurn("simulate it", current);
    assert.equal(simulated.result?.tool, "simulatePlan");
    assert.equal(simulated.session.executionState, "simulated");
    current = simulated.session;

    const approved = await runTurn("approve it", current);
    assert.equal(approved.result?.tool, "approvePlan");
    assert.equal(approved.session.approvalState, "approved");
    current = approved.session;

    const applied = await runTurn("apply it", current);
    assert.equal(applied.result?.tool, "applyPlan");
    assert.equal(applied.result?.status, "success");
    assert.equal(applied.session.executionState, "submitted");
  });

  it("blocks apply before approval", async () => {
    const recommended = await runTurn(
      "recommend what I should do with position 42",
      sessionWithWallet(),
    );
    const run = await runTurn("apply it", recommended.session);
    assert.equal(run.intent.intent, "apply_plan");
    assert.equal(run.result?.status, "error");
    assert.equal(run.result?.errorCode, "APPROVAL_REQUIRED");
  });
});

describe("runIntent product boundaries", () => {
  it("keeps standalone swaps outside the focused LP flow", async () => {
    const run = await runTurn("need t swap some eth to usdc", sessionWithWallet());
    assert.equal(run.intent.intent, "swap_tokens");
    assert.equal(run.result?.tool, "swapTokens");
    assert.equal(run.result?.status, "needs_confirmation");
    assert.equal(run.session.lastActionId, "swap_42");

    const approved = await runTurn("approve it", run.session);
    assert.equal(approved.intent.intent, "approve_plan");
    assert.equal(approved.intent.planId, "swap_42");
    assert.equal(approved.result?.tool, "approvePlan");
  });

  it("creating a brand-new position asks for capital before running", async () => {
    // Bare "create position" leaves the load-bearing fields (token + amount)
    // empty; the parser should ask once before the four-agent debate fires.
    const run = await runTurn("create position", sessionWithWallet());
    assert.equal(run.intent.intent, "needs_clarification");
    assert.equal(run.intent.pendingIntent, "create_position");
    assert.equal(run.intent.pendingField, "createCapital");
    assert.match(run.intent.clarification ?? "", /which token and how much/iu);
  });
});

const TEST_TOOLS: ToolRegistry = [
  {
    name: "createAgentWallet",
    intents: ["create_agent_wallet"],
    execute: () => ({
      tool: "createAgentWallet",
      status: "success",
      message: "Zuno wallet ready.",
      data: agentWalletData("created"),
    }),
  },
  {
    name: "showAgentWallet",
    intents: ["show_agent_wallet"],
    execute: () => ({
      tool: "showAgentWallet",
      status: "success",
      message: "Zuno wallet loaded.",
      data: agentWalletData("attached"),
    }),
  },
  {
    name: "showAgentWalletBalance",
    intents: ["show_agent_wallet_balance"],
    execute: () => ({
      tool: "showAgentWalletBalance",
      status: "success",
      message: "Balance loaded.",
      data: {
        agentWalletAddress: agentWallet,
        chainId: 8453,
        chainName: "Base",
        native: { symbol: "ETH", amount: "0.25" },
        funded: true,
      },
    }),
  },
  {
    name: "fundAgentWallet",
    intents: ["fund_agent_wallet"],
    execute: () => ({
      tool: "fundAgentWallet",
      status: "success",
      message: "Funding instructions.",
      data: {
        agentWalletAddress: agentWallet,
        userWalletAddress: null,
        chainId: 8453,
        status: "ready",
        instructions: [`send funds to ${agentWallet}`],
      },
    }),
  },
  {
    name: "listAgentWalletPositions",
    intents: ["list_positions"],
    execute: () => ({
      tool: "listAgentWalletPositions",
      status: "success",
      message: "Positions loaded.",
      data: {
        agentWalletAddress: agentWallet,
        chainId: 8453,
        positions: [{ positionId: "42", pair: "WETH/USDC", feeTier: 500 }],
      },
    }),
  },
  {
    name: "swapTokens",
    intents: ["swap_tokens"],
    execute: () => ({
      tool: "swapTokens",
      status: "needs_confirmation",
      message: "Prepared swap.",
      data: {
        preparedAction: {
          id: "swap_42",
          kind: "swap",
          summary: {
            kind: "swap",
            chainId: 8453,
            chainName: "Base",
            tokenIn: { symbol: "WETH", address: agentWallet, decimals: 18 },
            tokenOut: { symbol: "USDC", address: agentWallet, decimals: 6 },
            amountIn: "1",
            amountOut: "2500",
            minimumOut: "2487.5",
            route: "Trading API",
            source: "uniswap_trading_api",
            notes: [],
          },
          transactions: [],
          expiresAt: Date.now() + 60_000,
        },
        prompt: 'Type "approve it" to confirm.',
      },
    }),
  },
  {
    name: "inspectPosition",
    intents: ["inspect_position"],
    execute: (intent) => ({
      tool: "inspectPosition",
      status: "success",
      message: "Position loaded.",
      data: inspectData(intent.positionId ?? "42"),
    }),
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
    name: "approvePlan",
    intents: ["approve_plan"],
    execute: async (intent, context) => {
      const planId = intent.planId ?? context.session.lastPlanId;
      const plan = planId ? await context.planStore?.get(planId) : null;
      if (!plan && planId?.startsWith("swap_")) {
        return {
          tool: "approvePlan",
          status: "success",
          message: "Approved swap.",
          data: {
            kind: "swap",
            planId,
            actionId: planId,
            positionId: planId,
            agentWalletAddress: agentWallet,
            approvalState: "approved",
            executionState: "approved",
            summary: "approved test swap",
            warnings: [],
            tokenIn: { symbol: "WETH", address: agentWallet, decimals: 18 },
            tokenOut: { symbol: "USDC", address: agentWallet, decimals: 6 },
            amountIn: "1",
            amountOut: "2500",
            minimumOut: "2487.5",
            route: "Trading API",
            estimatedGas: "150000",
            estimatedGasUsd: 0.01,
            verdict: "approve",
            confidence: 0.9,
            reasons: ["approved by risk"],
            signer: "turnkey",
          },
        };
      }
      return plan
        ? {
            tool: "approvePlan",
            status: "success",
            message: "Approved.",
            data: {
              planId: plan.id,
              positionId: plan.positionId,
              agentWalletAddress: agentWallet,
              approvalState: "approved",
              executionState: "approved",
              summary: "approved test plan",
              warnings: [],
            },
          }
        : {
            tool: "approvePlan",
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
      if (!plan && planId?.startsWith("swap_")) {
        return {
          tool: "applyPlan",
          status: "success",
          message: "Swap applied.",
          data: {
            kind: "swap",
            planId,
            actionId: planId,
            positionId: planId,
            agentWalletAddress: agentWallet,
            approvalState: "approved",
            executionState: "submitted",
            status: "submitted",
            summary: "submitted test swap",
            pair: "WETH/USDC",
            feeTier: 0,
            oldRange: { priceLower: 0, priceUpper: 0 },
            newRange: { priceLower: 0, priceUpper: 0 },
            residual: { token0: "0", token1: "0" },
            estimatedGas: "150000",
            estimatedGasUsd: 0.01,
            estimatedSlippage: 0.001,
            verdict: "approve",
            confidence: 0.9,
            reasons: ["approved by risk"],
            warnings: [],
            signer: "turnkey",
            tokenIn: { symbol: "WETH", address: agentWallet, decimals: 18 },
            tokenOut: { symbol: "USDC", address: agentWallet, decimals: 6 },
            amountIn: "1",
            amountOut: "2500",
            minimumOut: "2487.5",
            route: "Trading API",
            transactionHash: `0x${"12".repeat(32)}` as Hex,
            turnkeyActivityId: "act_test",
          },
        };
      }
      if (!plan) {
        return {
          tool: "applyPlan",
          status: "error",
          message: "Plan was not found.",
          errorCode: "PLAN_NOT_FOUND",
        };
      }
      if (context.session.approvalState !== "approved") {
        return {
          tool: "applyPlan",
          status: "error",
          message: "Approval required.",
          errorCode: "APPROVAL_REQUIRED",
        };
      }
      return {
        tool: "applyPlan",
        status: "success",
        message: "Submitted through Turnkey.",
        data: {
          planId: plan.id,
          positionId: plan.positionId,
          agentWalletAddress: agentWallet,
          approvalState: "approved",
          executionState: "submitted",
          status: "submitted",
          summary: "submitted",
          pair: "WETH/USDC",
          feeTier: 500,
          oldRange: { priceLower: 1, priceUpper: 2 },
          newRange: { priceLower: 1.1, priceUpper: 2.1 },
          residual: { token0: "0", token1: "0" },
          estimatedGas: "350000",
          estimatedGasUsd: 0.01,
          estimatedSlippage: 0.001,
          verdict: "approve",
          confidence: 0.9,
          reasons: ["approved by risk"],
          warnings: [],
          signer: "turnkey",
          turnkeyActivityId: "act_test",
        },
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
];

function sessionWithWallet(): SessionState {
  return {
    ...emptySession,
    agentWalletAddress: agentWallet,
    chainId: 8453,
  };
}

function agentWalletData(status: string) {
  return {
    agentWalletAddress: agentWallet,
    userWalletAddress: null,
    chainId: 8453,
    chainName: "Base",
    provider: "turnkey",
    status,
    walletId: "wallet_test",
  };
}

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
    owner: agentWallet,
    pool: {
      address: "0x2222222222222222222222222222222222222222" as Address,
      chainId: 8453,
      token0: {
        address: "0x4200000000000000000000000000000000000006" as Address,
        symbol: "WETH",
        decimals: 18,
      },
      token1: {
        address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as Address,
        symbol: "USDC",
        decimals: 6,
      },
      feeTier: 500,
      tickSpacing: 10,
      currentTick,
      sqrtPriceX96: "0",
      liquidity: "12345678901234567890",
      price: tickToPrice(currentTick, 18, 6),
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
