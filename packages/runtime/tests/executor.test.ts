import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { Address, Hex, Plan, Position, SessionState } from "@zuno/core";
import { recommendPlan } from "@zuno/strategy/planner";
import { createMemoryAlertStore, createMemoryPlanStore } from "@zuno/storage";
import { buildSnapshot, tickToPrice } from "@zuno/chain/uniswap";
import type {
  AgentWallet,
  AgentWalletBalance,
  AgentWalletService,
  CreateAgentWalletInput,
  TurnkeySignResult,
  TurnkeyTransactionRequest,
} from "@zuno/chain/wallet";
import { executeIntent } from "../src/executor/execute-intent.js";
import { TOOLS } from "../src/tools/index.js";
import type { ExecutionContext } from "../src/contracts/types.js";

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

afterEach(() => {
  delete process.env.ZUNO_UNISWAP_REBALANCE_CALLDATA;
});

describe("executor agent wallet lifecycle", () => {
  it("creates a Turnkey-backed Zuno wallet and updates session", async () => {
    const walletService = testWalletService();
    const outcome = await executeIntent(intent("create_agent_wallet"), ctx({ walletService }));

    assert.equal(outcome.result.status, "success");
    assert.equal(outcome.result.tool, "createAgentWallet");
    assert.equal(outcome.session.agentWalletAddress, agentWallet);
    assert.equal(outcome.session.chainId, 42161);
    assert.equal(outcome.session.approvalState, "idle");
    assert.equal(outcome.session.lastIntent, "create_agent_wallet");
  });

  it("shows the current Zuno wallet from session state", async () => {
    const outcome = await executeIntent(
      intent("show_agent_wallet"),
      ctx({ session: session({ agentWalletAddress: agentWallet, chainId: 8453 }) }),
    );

    assert.equal(outcome.result.status, "success");
    assert.equal(outcome.result.tool, "showAgentWallet");
    assert.equal(outcome.session.agentWalletAddress, agentWallet);
  });

  it("returns funding instructions for the agent wallet", async () => {
    const outcome = await executeIntent(
      intent("fund_agent_wallet"),
      ctx({ session: session({ agentWalletAddress: agentWallet, chainId: 8453 }) }),
    );

    assert.equal(outcome.result.status, "success");
    assert.equal(outcome.result.tool, "fundAgentWallet");
    assert.match(outcome.result.message, /Fund/iu);
  });

  it("reads agent wallet balance through the wallet boundary", async () => {
    const outcome = await executeIntent(
      intent("show_agent_wallet_balance"),
      ctx({
        session: session({ agentWalletAddress: agentWallet, chainId: 8453 }),
        walletService: testWalletService({ nativeBalance: "0.25" }),
      }),
    );

    assert.equal(outcome.result.status, "success");
    assert.equal(outcome.result.tool, "showAgentWalletBalance");
    assert.equal(outcome.session.agentWalletAddress, agentWallet);
  });
});

describe("executor plan approval and execution", () => {
  it("simulates the latest plan and marks the execution state", async () => {
    const plan = testPlan();
    const outcome = await executeIntent(
      intent("simulate_plan"),
      ctx({
        session: session({ agentWalletAddress: agentWallet, chainId: 8453, lastPlanId: plan.id }),
        planStore: createMemoryPlanStore([plan]),
      }),
    );

    assert.equal(outcome.result.status, "success");
    assert.equal(outcome.result.tool, "simulatePlan");
    assert.equal(outcome.session.executionState, "simulated");
  });

  it("approves a plan for the Zuno execution wallet", async () => {
    const plan = testPlan();
    const outcome = await executeIntent(
      intent("approve_plan"),
      ctx({
        session: session({ agentWalletAddress: agentWallet, chainId: 8453, lastPlanId: plan.id }),
        planStore: createMemoryPlanStore([plan]),
      }),
    );

    assert.equal(outcome.result.status, "success");
    assert.equal(outcome.result.tool, "approvePlan");
    assert.equal(outcome.session.approvalState, "approved");
    assert.equal(outcome.session.executionState, "approved");
  });

  it("blocks apply until the user approves the plan", async () => {
    const plan = testPlan();
    const outcome = await executeIntent(
      intent("apply_plan"),
      ctx({
        session: session({ agentWalletAddress: agentWallet, chainId: 8453, lastPlanId: plan.id }),
        planStore: createMemoryPlanStore([plan]),
      }),
    );

    assert.equal(outcome.result.status, "error");
    assert.equal(outcome.result.errorCode, "APPROVAL_REQUIRED");
  });

  it("refuses to sign when no wallet service is wired up", async () => {
    const plan = testPlan();
    const outcome = await executeIntent(
      intent("apply_plan"),
      ctx({
        session: session({
          agentWalletAddress: agentWallet,
          chainId: 8453,
          lastPlanId: plan.id,
          approvalState: "approved",
        }),
        planStore: createMemoryPlanStore([plan]),
        executionReadiness: { checkAllowances: false, checkChain: false },
        // No walletService - Turnkey signing must fail closed.
      }),
    );

    assert.equal(outcome.result.status, "error");
    assert.equal(outcome.result.errorCode, "TURNKEY_SIGNING_FAILED");
  });

  it("signs and submits through the Turnkey boundary after approval", async () => {
    process.env.ZUNO_UNISWAP_REBALANCE_CALLDATA = "0x1234";
    const plan = testPlan();
    const walletService = testWalletService();
    const outcome = await executeIntent(
      intent("apply_plan"),
      ctx({
        session: session({
          agentWalletAddress: agentWallet,
          chainId: 8453,
          lastPlanId: plan.id,
          approvalState: "approved",
        }),
        planStore: createMemoryPlanStore([plan]),
        walletService,
        executionReadiness: { checkAllowances: false, checkChain: false },
      }),
    );

    assert.equal(outcome.result.status, "success");
    assert.equal(outcome.result.tool, "applyPlan");
    assert.equal(outcome.session.executionState, "submitted");
    assert.equal(walletService.signed.length, 1);
  });

  it("reports Turnkey signing failures clearly", async () => {
    process.env.ZUNO_UNISWAP_REBALANCE_CALLDATA = "0x1234";
    const plan = testPlan();
    const outcome = await executeIntent(
      intent("apply_plan"),
      ctx({
        session: session({
          agentWalletAddress: agentWallet,
          chainId: 8453,
          lastPlanId: plan.id,
          approvalState: "approved",
        }),
        planStore: createMemoryPlanStore([plan]),
        walletService: testWalletService({ failSigning: true }),
        executionReadiness: { checkAllowances: false, checkChain: false },
      }),
    );

    assert.equal(outcome.result.status, "error");
    assert.equal(outcome.result.errorCode, "TURNKEY_SIGNING_FAILED");
    assert.equal(outcome.session.executionState, "failed");
  });
});

describe("executor mappings", () => {
  it("maps every actionable intent to one tool", () => {
    const intents = TOOLS.flatMap((tool) => tool.intents);
    for (const expected of [
      "create_agent_wallet",
      "show_agent_wallet",
      "show_agent_wallet_balance",
      "fund_agent_wallet",
      "approve_token",
      "prepare_swap",
      "swap_tokens",
      "list_positions",
      "inspect_position",
      "recommend_rebalance",
      "show_diff",
      "simulate_plan",
      "approve_plan",
      "apply_plan",
      "create_position",
      "refresh_pools",
    ]) {
      assert.ok(intents.includes(expected as never), `${expected} is mapped`);
    }
  });
});

function ctx(
  options: {
    session?: SessionState;
    planStore?: ExecutionContext["planStore"];
    walletService?: TestWalletService;
    executionReadiness?: ExecutionContext["executionReadiness"];
  } = {},
): ExecutionContext {
  return {
    session: options.session ?? emptySession,
    tools: TOOLS,
    planStore: options.planStore ?? createMemoryPlanStore(),
    alertStore: createMemoryAlertStore(),
    walletService: options.walletService,
    executionReadiness: options.executionReadiness,
  };
}

function session(patch: Partial<SessionState>): SessionState {
  return { ...emptySession, ...patch };
}

function intent(kind: Parameters<typeof executeIntent>[0]["intent"]) {
  return { intent: kind, rawInput: kind, confidence: 1 };
}

interface TestWalletService extends AgentWalletService {
  signed: TurnkeyTransactionRequest[];
}

function testWalletService(
  options: { nativeBalance?: string; failSigning?: boolean } = {},
): TestWalletService {
  const signed: TurnkeyTransactionRequest[] = [];
  return {
    signed,
    async create(input: CreateAgentWalletInput): Promise<AgentWallet> {
      return {
        address: agentWallet,
        chainId: input.chainId,
        provider: "turnkey",
        status: "created",
        walletId: "wallet_test",
      };
    },
    async get(chainId): Promise<AgentWallet> {
      return {
        address: agentWallet,
        chainId,
        provider: "turnkey",
        status: "attached",
        walletId: "wallet_test",
      };
    },
    async balance(wallet: AgentWallet): Promise<AgentWalletBalance> {
      return {
        address: wallet.address,
        chainId: wallet.chainId,
        native: { symbol: "ETH", amount: options.nativeBalance ?? "0" },
        funded: (options.nativeBalance ?? "0") !== "0",
      };
    },
    async signAndSubmit(tx: TurnkeyTransactionRequest): Promise<TurnkeySignResult> {
      if (options.failSigning) throw new Error("turnkey denied by policy");
      signed.push(tx);
      return {
        status: "submitted",
        transactionHash: `0x${"12".repeat(32)}` as Hex,
        turnkeyActivityId: "act_test",
      };
    },
  };
}

function testPlan(): Plan {
  const plan = recommendPlan(buildSnapshot(testPosition()));
  return {
    ...plan,
    recommended: {
      ...plan.recommended,
      deploy0: "500000000000000000",
      deploy1: "500000000",
      required0: "500000000000000000",
      required1: "500000000",
      residual0: "500000000000000000",
      residual1: "500000000",
      shortfall0: "0",
      shortfall1: "0",
      prepAction: undefined,
    },
  };
}

function testPosition(): Position {
  const currentTick = -198_300;
  return {
    id: "42",
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
      liquidity: "1000000000000000000",
      price: tickToPrice(currentTick, 18, 6),
    },
    tickLower: -199_000,
    tickUpper: -197_000,
    liquidity: "1000000000000000000",
    amount0: "1000000000000000000",
    amount1: "1000000000",
    feesOwed0: "0",
    feesOwed1: "0",
  };
}
