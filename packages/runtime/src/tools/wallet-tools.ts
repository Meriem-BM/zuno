import { chainName, configuredWatchAddress, defaultChainId } from "@zuno/config";
import { listPositions, pairName } from "@zuno/uniswap";
import type { ToolDefinition } from "../contracts/types.js";
import { err, missingReadTarget, ok, resolveReadTarget } from "./shared.js";

const connectWallet: ToolDefinition = {
  name: "connectWallet",
  intents: ["connect_wallet"],
  execute: () => {
    const watchAddress = configuredWatchAddress();
    if (!watchAddress) {
      return err(
        "connectWallet",
        "WATCH_ADDRESS_NOT_SET",
        "Read-only mode does not need wallet connection. Paste an address or set ZUNO_WATCH_ADDRESS; approval happens by QR when you apply a plan.",
      );
    }
    const chainId = defaultChainId();
    return ok(
      "connectWallet",
      `Read-only target set to ${shortAddr(watchAddress)} on ${chainName(chainId)}.`,
      {
        watchAddress,
        walletAddress: null,
        chainId,
        chainName: chainName(chainId),
        signerMode: null,
      },
    );
  },
};

const showWatchTarget: ToolDefinition = {
  name: "showWatchTarget",
  intents: ["show_watch_target"],
  execute: (intent, ctx) => {
    const target = resolveReadTarget(intent, ctx);
    if (!target) return missingReadTarget("showWatchTarget");
    return ok("showWatchTarget", `Watching ${shortAddr(target.address)} on ${target.chainName}.`, {
      watchAddress: target.address,
      walletAddress: ctx.session.walletAddress,
      chainId: target.chainId,
      chainName: target.chainName,
      signerMode: ctx.session.signerMode,
      execution: ctx.session.walletAddress ? "wallet_connected" : "read_only",
    });
  },
};

const showWalletBalance: ToolDefinition = {
  name: "showWalletBalance",
  intents: ["show_balance"],
  execute: (intent, ctx) => {
    const target = resolveReadTarget(intent, ctx);
    if (!target) {
      return missingReadTarget("showWalletBalance");
    }
    return err(
      "showWalletBalance",
      "EXECUTION_NOT_AVAILABLE",
      "Token balance reads are not enabled yet. LP position reads work in read-only mode.",
    );
  },
};

const createPosition: ToolDefinition = {
  name: "createPosition",
  intents: ["create_position"],
  execute: () =>
    err(
      "createPosition",
      "EXECUTION_NOT_AVAILABLE",
      "Zuno does not create brand-new LP positions yet. It can inspect existing positions, recommend a rebalance, show a diff, simulate it, then prepare QR approval.",
    ),
};

const swapTokens: ToolDefinition = {
  name: "swapTokens",
  intents: ["swap_tokens"],
  execute: () =>
    err(
      "swapTokens",
      "EXECUTION_NOT_AVAILABLE",
      "Zuno does not run standalone swaps. It is focused on Uniswap LP positions: inspect positions, recommend a rebalance, show the diff, simulate it, then prepare QR approval.",
    ),
};

const listWalletPositions: ToolDefinition = {
  name: "listWalletPositions",
  intents: ["list_positions"],
  execute: async (intent, ctx) => {
    const target = resolveReadTarget(intent, ctx);
    if (!target) return missingReadTarget("listWalletPositions");
    try {
      const positions = await listPositions(target.address, { chainId: target.chainId });
      return ok(
        "listWalletPositions",
        `Loaded ${positions.length} positions for ${shortAddr(target.address)} on ${chainName(target.chainId)}.`,
        {
          walletAddress: target.address,
          watchAddress: target.address,
          chainId: target.chainId,
          positions: positions.map((position) => ({
            positionId: position.id,
            pair: pairName(position),
            feeTier: position.pool.feeTier,
          })),
        },
      );
    } catch (error) {
      return err(
        "listWalletPositions",
        "CHAIN_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  },
};

export const WALLET_TOOLS: readonly ToolDefinition[] = [
  connectWallet,
  showWatchTarget,
  showWalletBalance,
  createPosition,
  swapTokens,
  listWalletPositions,
];

function shortAddr(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
