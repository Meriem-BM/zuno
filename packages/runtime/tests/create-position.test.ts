import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { Address, Hex, SessionState } from "@zuno/core";
import { createMemoryAlertStore, createMemoryPlanStore } from "@zuno/storage";
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

/**
 * End-to-end create-position test against the deterministic agent path.
 *
 * Flow exercised:
 *   1. parseIntent("create ETH/USDC position with 0.05 ETH passively") →
 *      `create_position` intent with createGoal.
 *   2. executeIntent runs the create flow → seeded pool fixture →
 *      runDebateCreate → produces a `needs_confirmation` result with a
 *      CreatePositionPreparedActionSummary.
 *   3. Approve flow flips approvalState; apply_plan signs via fake wallet.
 */

const agentWallet = "0xabc1230000000000000000000000000000000def" as Address;

const baseSession: SessionState = {
  userWalletAddress: null,
  agentWalletAddress: agentWallet,
  chainId: 11155111,
  lastPositionId: null,
  lastPlanId: null,
  lastActionId: null,
  lastIntent: null,
  approvalState: "idle",
  executionState: "idle",
};

describe("create_position end-to-end (deterministic)", () => {
  let cacheDir: string;
  let prevCacheDir: string | undefined;
  let prevDeterministic: string | undefined;
  let prevKey: string | undefined;

  beforeEach(() => {
    prevCacheDir = process.env.ZUNO_POOL_CACHE_DIR;
    prevDeterministic = process.env.ZUNO_DETERMINISTIC;
    prevKey = process.env.OPENAI_API_KEY;
    cacheDir = mkdtempSync(join(tmpdir(), "zuno-create-rt-"));
    process.env.ZUNO_POOL_CACHE_DIR = cacheDir;
    process.env.ZUNO_DETERMINISTIC = "true";
    delete process.env.OPENAI_API_KEY;
    seedFixture(cacheDir);
  });

  afterEach(() => {
    if (prevCacheDir === undefined) delete process.env.ZUNO_POOL_CACHE_DIR;
    else process.env.ZUNO_POOL_CACHE_DIR = prevCacheDir;
    if (prevDeterministic === undefined) delete process.env.ZUNO_DETERMINISTIC;
    else process.env.ZUNO_DETERMINISTIC = prevDeterministic;
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
  });

  it("returns needs_confirmation with a create-position prepared action", async () => {
    const outcome = await executeIntent(
      {
        intent: "create_position",
        rawInput: "create position with 0.05 ETH passively",
        confidence: 1,
        createGoal: {
          capital: { tokenSymbol: "weth", amount: "0.05" },
          riskProfile: "conservative",
          exposurePreference: "neutral",
        },
      },
      makeCtx(baseSession),
    );

    assert.equal(outcome.result.status, "needs_confirmation");
    assert.equal(outcome.result.tool, "createPosition");
    const data = outcome.result.data as {
      preparedAction: { id: string; kind: string; summary: { pool: { token0: { symbol: string }; token1: { symbol: string }; feeTier: number } } };
    };
    assert.equal(data.preparedAction.kind, "lp_create");
    assert.match(data.preparedAction.id, /^act_/u);
    const pool = data.preparedAction.summary.pool;
    assert.ok(pool.token0.symbol === "WETH" || pool.token1.symbol === "WETH");
  });

  it("rejects when goal is missing capital", async () => {
    const outcome = await executeIntent(
      {
        intent: "create_position",
        rawInput: "create",
        confidence: 1,
        createGoal: { riskProfile: "balanced" },
      },
      makeCtx(baseSession),
    );
    assert.equal(outcome.result.status, "error");
    assert.equal(outcome.result.errorCode, "INTENT_NOT_ACTIONABLE");
  });
});

function makeCtx(s: SessionState): ExecutionContext {
  return {
    session: s,
    tools: TOOLS,
    planStore: createMemoryPlanStore(),
    alertStore: createMemoryAlertStore(),
    walletService: createTestWallet(),
  };
}

function seedFixture(dir: string): void {
  const weth = {
    address: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14" as Address,
    symbol: "WETH",
    decimals: 18,
  };
  const usdc = {
    address: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" as Address,
    symbol: "USDC",
    decimals: 6,
  };
  const entry = (feeTier: number, liquidity: string) => ({
    poolManager: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
    poolId: `0x${feeTier.toString(16).padStart(64, "0")}`,
    pool: {
      address: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
      chainId: 11155111,
      token0: weth,
      token1: usdc,
      feeTier,
      tickSpacing: feeTier === 500 ? 10 : feeTier === 3000 ? 60 : 200,
      currentTick: 0,
      sqrtPriceX96: "79228162514264337593543950336",
      liquidity,
      price: 1,
    },
  });
  writeFileSync(
    join(dir, `pools-11155111.json`),
    JSON.stringify({
      fetchedAt: Date.now(),
      chainId: 11155111,
      entries: [entry(500, "12345678901234567890"), entry(3000, "9876543210987654321")],
    }),
  );
}

function createTestWallet(): AgentWalletService {
  return {
    async create(input: CreateAgentWalletInput): Promise<AgentWallet> {
      return {
        address: agentWallet,
        chainId: input.chainId,
        provider: "turnkey",
        status: "created",
      };
    },
    async get(chainId): Promise<AgentWallet> {
      return { address: agentWallet, chainId, provider: "turnkey", status: "attached" };
    },
    async balance(wallet: AgentWallet): Promise<AgentWalletBalance> {
      return {
        address: wallet.address,
        chainId: wallet.chainId,
        native: { symbol: "ETH", amount: "1" },
        funded: true,
      };
    },
    async signAndSubmit(_tx: TurnkeyTransactionRequest): Promise<TurnkeySignResult> {
      return {
        status: "submitted",
        transactionHash: `0x${"ab".repeat(32)}` as Hex,
        turnkeyActivityId: "act_test",
      };
    },
  };
}
