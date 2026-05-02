import { chainName, defaultChainId } from "@zuno/chain/config";
import type { AgentWallet } from "@zuno/chain/wallet";
import { buildMint, listPositions, pairName } from "@zuno/chain/uniswap";
import type {
  AgentThought,
  AxlEnvelope,
  ChainId,
  CreateStart,
  FlowFailed,
  Plan,
  PlanReady,
} from "@zuno/core";
import { newPreparedActionId, newRequestId } from "@zuno/core";
import { AGENT_ROLES, AxlClient, peerIdFor } from "@zuno/strategy/axl";
import { agentsAvailable, runDebateCreate } from "@zuno/strategy/agents";
import type {
  CreatePositionPreparedActionSummary,
  NeedsConfirmationData,
  PreparedAction,
  ToolDefinition,
  ToolExecutionResult,
} from "../../contracts/types.js";
import {
  err,
  missingAgentWallet,
  needsConfirmation,
  ok,
  preparedActionStore,
  resolveAgentWallet,
  walletService,
} from "../shared.js";

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
        'Tell me which token and how much you want to deploy, e.g. "0.05 ETH" or "1000 USDC".',
      );
    }
    const start: CreateStart = {
      goal: { ...goal, chain: goal.chain ?? target.chainId },
      owner: target.address,
    };

    try {
      const plan = await produceCreate(start, target.chainId);
      // Build the mint calldata + prepared action.
      const summary = buildCreateSummary(plan, target.chainId);
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
      // Persist for `apply it` follow-up.
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
        // prepared-action store optional in tests
      }
      const data: NeedsConfirmationData<CreatePositionPreparedActionSummary> = {
        preparedAction,
        prompt: `Mint ${summary.amount0} ${summary.pool.token0.symbol} + ${summary.amount1} ${summary.pool.token1.symbol} on ${summary.pool.token0.symbol}/${summary.pool.token1.symbol} ${(summary.pool.feeTier / 10_000).toFixed(2)}%? Type "approve it" to sign.`,
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

// AXL first, then in-process orchestrator. No deterministic fallback for
// create: without a goal-driven proposal there's nothing meaningful to
// emit, so we surface a clear error instead.
async function produceCreate(start: CreateStart, chainId: ChainId): Promise<Plan> {
  const meshPlan = await tryMeshCreate(start, chainId);
  if (meshPlan) return meshPlan;
  if (agentsAvailable() || process.env.ZUNO_DETERMINISTIC === "true") {
    const result = await runDebateCreate({ start, chainId });
    return attachTranscript(result.plan, result.ready.transcript);
  }
  throw new Error(
    "create flow requires either a running AXL mesh or OPENAI_API_KEY for the in-process debate",
  );
}

async function tryMeshCreate(start: CreateStart, chainId: ChainId): Promise<Plan | null> {
  let client: AxlClient;
  try {
    client = new AxlClient({ role: "cli", pollIntervalMs: 150 });
    const topology = await client.topology();
    const visible = new Set(topology.peers);
    for (const role of AGENT_ROLES) {
      if (!visible.has(peerIdFor(role))) return null;
    }
  } catch {
    return null;
  }
  const requestId = newRequestId();
  const env: AxlEnvelope<CreateStart> = {
    requestId,
    from: "cli",
    to: "scout",
    kind: "flow_create_start",
    payload: { ...start, owner: start.owner, goal: { ...start.goal, chain: chainId } },
    ts: Date.now(),
  };
  await client.send(env);

  const transcript: AgentThought[] = [];
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const inbox = await client.recv();
    for (const msg of inbox) {
      if (msg.requestId !== requestId) continue;
      if (msg.kind === "agent_thought") {
        transcript.push(msg.payload as AgentThought);
        continue;
      }
      if (msg.kind === "plan_ready") {
        const ready = msg.payload as PlanReady;
        return attachTranscript(ready.plan, [...transcript, ...(ready.transcript ?? [])]);
      }
      if (msg.kind === "flow_failed") {
        const f = msg.payload as FlowFailed;
        throw new Error(`AXL create flow failed at ${f.stage}: ${f.message}`);
      }
    }
    await sleep(150);
  }
  throw new Error("AXL create flow timed out");
}

function attachTranscript(plan: Plan, transcript: AgentThought[]): Plan {
  if (transcript.length === 0) return plan;
  const lines = transcript.map((t) => `[${t.role}] ${t.text}`);
  return { ...plan, risk: { ...plan.risk, reasons: [...plan.risk.reasons, ...lines] } };
}

function buildCreateSummary(plan: Plan, chainId: ChainId): CreatePositionPreparedActionSummary {
  const pool = plan.snapshot.position.pool;
  // Slippage buffer: cap at deposit + 1% so the chain reverts if real
  // amounts come back materially higher (e.g. tick rounding plus drift).
  const amount0Max = withSlippage(plan.recommended.deploy0, 100);
  const amount1Max = withSlippage(plan.recommended.deploy1, 100);
  const goalSummary = plan.risk.reasons[0] ?? "agent debate concluded";
  const notes: string[] = [];
  if (plan.recommended.prepAction) notes.push(plan.recommended.prepAction);
  notes.push(`debate decided by ${plan.risk.reasons.some((r) => r.startsWith("[arbiter]")) ? "arbiter" : "critic"}`);
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
    amount0: plan.recommended.deploy0,
    amount1: plan.recommended.deploy1,
    expectedYield24hUsd: 0,
    prepAction: plan.recommended.prepAction,
    goalSummary,
    amount0Max,
    amount1Max,
    notes,
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
