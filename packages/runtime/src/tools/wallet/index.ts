import { chainName, defaultChainId } from "@zuno/chain/config";
import type { AgentWallet } from "@zuno/chain/wallet";
import {
  buildMint,
  listPositions,
  liquidityForAmounts,
  pairName,
  PositionDetailsReadError,
} from "@zuno/chain/uniswap";
import type { AgentThought, ChainId, CreateStart, Plan } from "@zuno/core";
import { newPreparedActionId } from "@zuno/core";
import { agentsAvailable, runDebateCreate } from "@zuno/strategy/agents";
import type {
  CreatePositionPreparedActionSummary,
  NeedsConfirmationData,
  PreparedAction,
  ToolDefinition,
  ToolExecutionResult,
} from "../../contracts/types.js";
import { attachTranscript, runMeshFlow } from "../lib/mesh.js";
import {
  err,
  formatAmount,
  missingAgentWallet,
  needsConfirmation,
  ok,
  preparedActionStore,
  resolveAgentWallet,
  walletService,
} from "../shared.js";

const CREATE_MINT_SLIPPAGE_BPS = 500;

const createAgentWallet: ToolDefinition = {
  name: "createAgentWallet",
  intents: ["create_agent_wallet"],
  execute: async (_, ctx) => {
    const chainId = ctx.session.chainId ?? defaultChainId();
    try {
      const wallet = await walletService(ctx).create({ chainId, walletName: "Zuno Agent Wallet" });
      return ok(
        "createAgentWallet",
        `Zuno wallet ${shortAddr(wallet.address)} is ready on ${chainName(chainId)}.`,
        {
          agentWalletAddress: wallet.address,
          userWalletAddress: ctx.session.userWalletAddress,
          chainId,
          chainName: chainName(chainId),
          provider: wallet.provider,
          status: wallet.status,
          walletId: wallet.walletId,
        },
      );
    } catch (error) {
      return err("createAgentWallet", "WALLET_AUTH_FAILED", errorMessage(error));
    }
  },
};

const showAgentWallet: ToolDefinition = {
  name: "showAgentWallet",
  intents: ["show_agent_wallet"],
  execute: async (_, ctx) => {
    const chainId = ctx.session.chainId ?? defaultChainId();
    const sessionWallet = ctx.session.agentWalletAddress;
    const wallet: AgentWallet | null = sessionWallet
      ? {
          address: sessionWallet,
          chainId,
          provider: "turnkey" as const,
          status: "attached",
        }
      : await walletService(ctx).get(chainId);
    if (!wallet) return missingAgentWallet("showAgentWallet");

    return ok(
      "showAgentWallet",
      `Zuno wallet ${shortAddr(wallet.address)} on ${chainName(chainId)}.`,
      {
        agentWalletAddress: wallet.address,
        userWalletAddress: ctx.session.userWalletAddress,
        chainId,
        chainName: chainName(chainId),
        provider: wallet.provider,
        status: wallet.status,
        walletId: wallet.walletId,
      },
    );
  },
};

const showAgentWalletBalance: ToolDefinition = {
  name: "showAgentWalletBalance",
  intents: ["show_agent_wallet_balance"],
  execute: async (_, ctx) => {
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("showAgentWalletBalance");
    try {
      const balance = await walletService(ctx).balance({
        address: target.address,
        chainId: target.chainId,
        provider: "turnkey",
        status: "attached",
      });
      return ok("showAgentWalletBalance", `Balance for ${shortAddr(target.address)}.`, {
        agentWalletAddress: target.address,
        chainId: target.chainId,
        chainName: target.chainName,
        native: balance.native,
        funded: balance.funded,
      });
    } catch (error) {
      return err("showAgentWalletBalance", "CHAIN_READ_FAILED", errorMessage(error));
    }
  },
};

const fundAgentWallet: ToolDefinition = {
  name: "fundAgentWallet",
  intents: ["fund_agent_wallet"],
  execute: (_, ctx) => {
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("fundAgentWallet");
    return ok("fundAgentWallet", `Fund ${shortAddr(target.address)} before executing LP actions.`, {
      agentWalletAddress: target.address,
      userWalletAddress: ctx.session.userWalletAddress,
      chainId: target.chainId,
      status: "ready",
      instructions: [
        `send funds from your main wallet to ${target.address}`,
        "keep only the funds you want Zuno to operate with",
        "Zuno signs from this Turnkey-backed agent wallet after approval",
      ],
    });
  },
};

const createPosition: ToolDefinition = {
  name: "createPosition",
  intents: ["create_position"],
  execute: async (intent, ctx) => {
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("createPosition");

    const goal = intent.createGoal;
    if (!goal?.capital?.tokenSymbol || !goal.capital.amount) {
      return err(
        "createPosition",
        "INTENT_NOT_ACTIONABLE",
        'Tell me which token and how much you want to deploy, e.g. "0.05 ETH" or "0.05 ETH and 100 USDC".',
      );
    }
    if (goal.capital2 && (!goal.capital2.tokenSymbol || !goal.capital2.amount)) {
      return err(
        "createPosition",
        "INTENT_NOT_ACTIONABLE",
        'Second capital is partial - give both amount and token, e.g. "0.05 ETH and 100 USDC".',
      );
    }
    const start: CreateStart = {
      goal: { ...goal, chain: goal.chain ?? target.chainId },
      owner: target.address,
    };

    try {
      const plan = await produceCreate(start, target.chainId, ctx.onAgentThought);
      if (plan.risk.verdict === "reject") {
        const reason = plan.risk.reasons[0] ?? "All candidates failed the risk floor.";
        return err(
          "createPosition",
          "INTENT_NOT_ACTIONABLE",
          `${reason} Try a less conservative profile (e.g. "balanced"), a different chain with deeper pools, or a smaller capital amount.`,
        );
      }
      const summary = buildCreateSummary(plan, target.chainId, goal.riskProfile ?? "balanced");
      const tx = buildMintFromPlan(plan, target.address, target.chainId);
      const preparedAction: PreparedAction<CreatePositionPreparedActionSummary> = {
        id: newPreparedActionId(),
        kind: "lp_create",
        summary,
        transactions: [
          {
            chainId: tx.chainId,
            to: tx.to,
            data: tx.data,
            value: tx.value,
            description: tx.description,
          },
        ],
        expiresAt: Date.now() + 5 * 60 * 1000,
      };
      try {
        await preparedActionStore(ctx).save({
          ...preparedAction,
          state: "pending_review",
          createdAt: Date.now(),
          ownerAddress: target.address,
          chainId: target.chainId,
          notes: summary.notes,
        });
      } catch {
        // Optional in tests.
      }
      const mintAmounts = describeMintAmounts(summary);
      const data: NeedsConfirmationData<CreatePositionPreparedActionSummary> = {
        preparedAction,
        prompt: `Mint ${mintAmounts} on ${summary.pool.token0.symbol}/${summary.pool.token1.symbol} ${(summary.pool.feeTier / 10_000).toFixed(2)}%? Type "approve it" to sign.`,
      };
      return needsConfirmation<CreatePositionPreparedActionSummary>(
        "createPosition",
        `Drafted create-position action ${preparedAction.id}. ${plan.risk.verdict} (${plan.risk.confidence.toFixed(2)}).`,
        data,
      ) satisfies ToolExecutionResult;
    } catch (error) {
      return err("createPosition", "CHAIN_READ_FAILED", errorMessage(error));
    }
  },
};

async function produceCreate(
  start: CreateStart,
  chainId: ChainId,
  onAgentThought?: (thought: AgentThought) => void,
): Promise<Plan> {
  const meshPlan = await runMeshFlow<CreateStart>({
    kind: "flow_create_start",
    payload: { ...start, owner: start.owner, goal: { ...start.goal, chain: chainId } },
    deadlineMs: 90_000,
    onAgentThought,
  });
  if (meshPlan) return meshPlan;
  if (agentsAvailable() || process.env.ZUNO_DETERMINISTIC === "true") {
    const result = await runDebateCreate({ start, chainId, onThought: onAgentThought });
    return attachTranscript(result.plan, result.ready.transcript);
  }
  throw new Error(
    "create flow requires either a running AXL mesh or OPENAI_API_KEY for the in-process debate",
  );
}

function scaleYieldToUserShare(
  plan: Plan,
  pool: {
    liquidity: string;
    currentTick: number;
    token0: { decimals: number };
    token1: { decimals: number };
  },
): number {
  const poolYieldUsd = plan.recommended.expectedYield24hUsd ?? 0;
  if (poolYieldUsd <= 0) return 0;
  let poolL: bigint;
  try {
    poolL = BigInt(pool.liquidity || "0");
  } catch {
    poolL = 0n;
  }
  const userL = liquidityForAmounts(
    plan.recommended.deploy0,
    plan.recommended.deploy1,
    pool.currentTick,
    plan.recommended.tickLower,
    plan.recommended.tickUpper,
    pool.token0.decimals,
    pool.token1.decimals,
  );
  if (userL <= 0n || poolL <= 0n) return 0;
  const totalL = userL + poolL;
  const ratio = Number((userL * 1_000_000n) / totalL) / 1_000_000;
  return poolYieldUsd * ratio;
}

export function describeMintAmounts(summary: CreatePositionPreparedActionSummary): string {
  const human0 = formatAmount(summary.amount0, summary.pool.token0.decimals);
  const human1 = formatAmount(summary.amount1, summary.pool.token1.decimals);
  const left = human0 !== "0";
  const right = human1 !== "0";
  if (left && right) {
    return `${human0} ${summary.pool.token0.symbol} + ${human1} ${summary.pool.token1.symbol}`;
  }
  if (left) return `${human0} ${summary.pool.token0.symbol} (single-sided)`;
  if (right) return `${human1} ${summary.pool.token1.symbol} (single-sided)`;
  return `0 ${summary.pool.token0.symbol}`;
}

function buildCreateSummary(
  plan: Plan,
  chainId: ChainId,
  riskProfile: "conservative" | "balanced" | "aggressive",
): CreatePositionPreparedActionSummary {
  const pool = plan.snapshot.position.pool;
  const amount0Max = withSlippage(plan.recommended.deploy0, CREATE_MINT_SLIPPAGE_BPS);
  const amount1Max = withSlippage(plan.recommended.deploy1, CREATE_MINT_SLIPPAGE_BPS);
  const goalSummary = plan.risk.reasons[0] ?? "agent debate concluded";
  const decidedBy = plan.risk.reasons.some((r) => r.startsWith("[arbiter]")) ? "arbiter" : "critic";
  const priceCurrent = plan.snapshot.range.priceCurrent;
  const inRange =
    priceCurrent >= plan.recommended.priceLower && priceCurrent <= plan.recommended.priceUpper;
  const rangeStatus = inRange
    ? "active  (fees accrue now)"
    : priceCurrent < plan.recommended.priceLower
      ? "parked above current  (activates when price rises into range)"
      : "parked below current  (activates when price falls into range)";
  const userYield24hUsd = scaleYieldToUserShare(plan, pool);
  return {
    kind: "create_position",
    chainId,
    chainName: chainName(chainId),
    pool: {
      address: pool.address,
      token0: pool.token0,
      token1: pool.token1,
      feeTier: pool.feeTier,
      tickSpacing: pool.tickSpacing,
    },
    tickLower: plan.recommended.tickLower,
    tickUpper: plan.recommended.tickUpper,
    priceLower: plan.recommended.priceLower,
    priceUpper: plan.recommended.priceUpper,
    priceCurrent,
    inRange,
    rangeStatus,
    amount0: plan.recommended.deploy0,
    amount1: plan.recommended.deploy1,
    expectedYield24hUsd: userYield24hUsd,
    prepAction: plan.recommended.prepAction,
    goalSummary,
    poolReason: plan.recommended.rationale,
    riskProfile,
    amount0Max,
    amount1Max,
    slippageBps: CREATE_MINT_SLIPPAGE_BPS,
    notes: [`debate decided by ${decidedBy}`],
  };
}

function buildMintFromPlan(plan: Plan, recipient: `0x${string}`, chainId: ChainId) {
  const pool = plan.snapshot.position.pool;
  return buildMint({
    chainId,
    token0: pool.token0,
    token1: pool.token1,
    fee: pool.feeTier,
    tickLower: plan.recommended.tickLower,
    tickUpper: plan.recommended.tickUpper,
    currentTick: pool.currentTick,
    amount0Desired: plan.recommended.deploy0,
    amount1Desired: plan.recommended.deploy1,
    amount0Max: withSlippage(plan.recommended.deploy0, CREATE_MINT_SLIPPAGE_BPS),
    amount1Max: withSlippage(plan.recommended.deploy1, CREATE_MINT_SLIPPAGE_BPS),
    amount0Min: "0",
    amount1Min: "0",
    recipient,
    deadline: Math.floor(Date.now() / 1000) + 30 * 60,
  });
}

function withSlippage(atomicAmount: string, bps: number): string {
  try {
    const v = BigInt(atomicAmount || "0");
    const buffered = (v * BigInt(10_000 + bps)) / 10_000n;
    return buffered.toString();
  } catch {
    return atomicAmount;
  }
}

const listAgentWalletPositions: ToolDefinition = {
  name: "listAgentWalletPositions",
  intents: ["list_positions"],
  execute: async (_, ctx) => {
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("listAgentWalletPositions");
    try {
      const positions = await listPositions(target.address, { chainId: target.chainId });
      return ok(
        "listAgentWalletPositions",
        `Loaded ${positions.length} positions in the Zuno wallet on ${chainName(target.chainId)}.`,
        {
          agentWalletAddress: target.address,
          chainId: target.chainId,
          positions: positions.map((position) => ({
            positionId: position.id,
            pair: pairName(position),
            feeTier: position.pool.feeTier,
          })),
        },
      );
    } catch (error) {
      if (error instanceof PositionDetailsReadError) {
        const loadedPositions = error.positions.map((position) => ({
          positionId: position.id,
          pair: pairName(position),
          feeTier: position.pool.feeTier,
        }));
        const unavailablePositions = error.tokenIds.map((positionId) => ({
          positionId,
          pair: "details unavailable (RPC rate-limited)",
        }));
        return ok(
          "listAgentWalletPositions",
          `Found ${loadedPositions.length + unavailablePositions.length} position id${loadedPositions.length + unavailablePositions.length === 1 ? "" : "s"} in the Zuno wallet on ${chainName(target.chainId)}, but RPC rate limits blocked ${unavailablePositions.length} detail read${unavailablePositions.length === 1 ? "" : "s"}.`,
          {
            agentWalletAddress: target.address,
            chainId: target.chainId,
            positions: [...loadedPositions, ...unavailablePositions],
          },
        );
      }
      return err("listAgentWalletPositions", "CHAIN_READ_FAILED", errorMessage(error));
    }
  },
};

export const WALLET_TOOLS: readonly ToolDefinition[] = [
  createAgentWallet,
  showAgentWallet,
  showAgentWalletBalance,
  fundAgentWallet,
  createPosition,
  listAgentWalletPositions,
];

function shortAddr(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
