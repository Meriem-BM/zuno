import { chainName, defaultChainId } from "@zuno/chain/config";
import type { AgentWallet } from "@zuno/chain/wallet";
import { listPositions, pairName } from "@zuno/chain/uniswap";
import type { ToolDefinition } from "../../contracts/types.js";
import { err, missingAgentWallet, ok, resolveAgentWallet, walletService } from "../shared.js";

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
  execute: () =>
    err(
      "createPosition",
      "EXECUTION_NOT_AVAILABLE",
      "Zuno does not create brand-new LP positions yet. Fund the Zuno wallet, inspect existing positions, then run reviewed rebalances.",
    ),
};

const swapTokens: ToolDefinition = {
  name: "swapTokens",
  intents: ["swap_tokens"],
  execute: () =>
    err(
      "swapTokens",
      "EXECUTION_NOT_AVAILABLE",
      "Zuno does not run standalone swaps. It only builds deterministic LP execution plans for the Zuno wallet.",
    ),
};

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
  swapTokens,
  listAgentWalletPositions,
];

function shortAddr(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
