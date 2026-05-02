import { chainName } from "@zuno/chain/config";
import { quoteSwap as quoteOnchainSwap, minOutputFor } from "@zuno/chain/uniswap";
import {
  buildSwap,
  quoteSwap as quoteTradingApiSwap,
  requireTradingApiConfig,
  tradingApiEnabled,
} from "@zuno/chain/uniswap/trading-api";
import { lookupToken } from "@zuno/chain/tokens";
import { newPreparedActionId } from "@zuno/core";
import type { Address, ChainId } from "@zuno/core";
import { formatUnits } from "viem";
import type {
  NeedsConfirmationData,
  SwapPreparedActionSummary,
  SwapQuoteData,
  ToolDefinition,
} from "../../contracts/types.js";
import {
  err,
  missingAgentWallet,
  needsConfirmation,
  ok,
  preparedActionStore,
  resolveAgentWallet,
} from "../shared.js";

const DEFAULT_SLIPPAGE_BPS = 50;

const prepareSwap: ToolDefinition = {
  name: "prepareSwap",
  intents: ["prepare_swap"],
  execute: async (intent, ctx) => {
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("prepareSwap");

    const preview = await buildSwapPreview(intent, target.address, target.chainId);
    return ok("prepareSwap", preview.message, preview.data);
  },
};

const showQuote: ToolDefinition = {
  name: "showQuote",
  intents: ["show_quote"],
  execute: async (intent, ctx) => {
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("showQuote");

    const preview = await buildSwapPreview(intent, target.address, target.chainId);
    return ok("showQuote", preview.message, preview.data);
  },
};

const swapTokens: ToolDefinition = {
  name: "swapTokens",
  intents: ["swap_tokens"],
  execute: async (intent, ctx) => {
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("swapTokens");
    if (!tradingApiEnabled()) {
      return err(
        "swapTokens",
        "EXECUTION_NOT_AVAILABLE",
        "Set ZUNO_UNISWAP_TRADING_API_KEY to enable swap execution through the Uniswap Trading API.",
      );
    }

    const apiConfig = requireTradingApiConfig();
    const preview = await buildSwapPreview(intent, target.address, target.chainId, {
      apiConfig,
      execution: true,
    });
    const summary = preview.data as SwapPreparedActionSummary;
    const id = newPreparedActionId();
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;
    const transactions = [
      {
        chainId: preview.swap.chainId,
        from: preview.swap.from,
        to: preview.swap.to,
        data: preview.swap.data,
        value: preview.swap.value,
        description: preview.swapDescription,
      },
    ];
    await preparedActionStore(ctx).save({
      id,
      kind: "swap",
      summary,
      transactions,
      state: "pending_review",
      createdAt: now,
      expiresAt,
      ownerAddress: target.address,
      chainId: target.chainId,
    });

    const data: NeedsConfirmationData<SwapPreparedActionSummary> = {
      preparedAction: { id, kind: "swap", summary, transactions, expiresAt },
      prompt: `Swap ${summary.amountIn} ${summary.tokenIn.symbol} for ${summary.tokenOut.symbol}? Type "approve it" to confirm.`,
    };
    return needsConfirmation<SwapPreparedActionSummary>(
      "swapTokens",
      `Prepared swap ${summary.amountIn} ${summary.tokenIn.symbol} → ${summary.tokenOut.symbol}.`,
      data,
    );
  },
};

export const SWAP_TOOLS: readonly ToolDefinition[] = [prepareSwap, showQuote, swapTokens];

async function buildSwapPreview(
  intent: { tokenSymbol?: string; tokenOutSymbol?: string; amount?: string },
  swapper: Address,
  chainId: ChainId,
  options: { apiConfig?: ReturnType<typeof requireTradingApiConfig>; execution?: boolean } = {},
): Promise<{
  message: string;
  data: SwapQuoteData | SwapPreparedActionSummary;
  swapDescription: string;
  swap: { from: Address; to: Address; data: `0x${string}`; value: string; chainId: ChainId };
}> {
  const tokenInSymbol = (intent.tokenSymbol ?? "eth").replace(/^eth$/iu, "weth");
  const tokenOutSymbol = (intent.tokenOutSymbol ?? "").replace(/^eth$/iu, "weth");
  const amount = intent.amount ?? "";

  if (!tokenOutSymbol || !amount) {
    throw new Error('I need both tokens and an amount. Try: "swap 1 ETH to USDC".');
  }

  const tokenIn = lookupToken(tokenInSymbol, chainId);
  const tokenOut = lookupToken(tokenOutSymbol, chainId);
  if (!tokenIn || !tokenOut) {
    throw new Error(
      `${tokenInSymbol.toUpperCase()}/${tokenOutSymbol.toUpperCase()} is not in the known token list for this chain.`,
    );
  }

  if (options.apiConfig) {
    const quote = await quoteTradingApiSwap(
      {
        swapper,
        tokenIn,
        tokenOut,
        amount,
        chainId,
        slippageTolerance: 0.5,
        routingPreference: "BEST_PRICE",
        protocols: ["V2", "V3", "V4"],
        permit2Enabled: false,
      },
      options.apiConfig,
    );
    const amountInWei = readAmount(quote.quote, "input", amount);
    const amountOutWei = readAmount(quote.quote, "output", "0");
    const amountIn = formatAmount(amountInWei, tokenIn.decimals);
    const amountOut = formatAmount(amountOutWei, tokenOut.decimals);
    const routeString = readString(quote.quote, "routeString") ?? quote.routing;
    if (options.execution) {
      const swap = await buildSwap(quote, options.apiConfig);
      const summary: SwapPreparedActionSummary = {
        kind: "swap",
        chainId,
        chainName: chainName(chainId),
        tokenIn: { symbol: tokenIn.symbol, address: tokenIn.address, decimals: tokenIn.decimals },
        tokenOut: { symbol: tokenOut.symbol, address: tokenOut.address, decimals: tokenOut.decimals },
        amountIn,
        amountOut,
        minimumOut: minOutputFromTradingApi(amountOutWei, tokenOut.decimals, DEFAULT_SLIPPAGE_BPS),
        route: routeString,
        source: "uniswap_trading_api",
        quoteId: readString(quote.quote, "quoteId"),
        requestId: quote.requestId,
        estimatedGas: readString(quote.quote, "gasUseEstimate") ?? swap.gasFee,
        estimatedGasUsd: undefined,
        notes: [
          `Routing: ${quote.routing}`,
          quote.permitData ? "Permit data returned by the Trading API." : "No permit data requested.",
        ],
      };
      return {
        message: `Best quote: ${summary.amountIn} ${summary.tokenIn.symbol} → ${summary.amountOut} ${summary.tokenOut.symbol}.`,
        data: summary,
        swapDescription: `swap ${summary.amountIn} ${summary.tokenIn.symbol} for ${summary.tokenOut.symbol}`,
        swap: swap.swap,
      };
    }

    const data: SwapQuoteData = {
      chainId,
      chainName: chainName(chainId),
      tokenIn: { symbol: tokenIn.symbol, address: tokenIn.address, decimals: tokenIn.decimals },
      tokenOut: { symbol: tokenOut.symbol, address: tokenOut.address, decimals: tokenOut.decimals },
      amountIn,
      amountOut,
      feeTier: 0,
      price: safePrice(amountIn, amountOut),
      route: routeString,
      minimumOut: minOutputFromTradingApi(amountOutWei, tokenOut.decimals, DEFAULT_SLIPPAGE_BPS),
      notes: [
        `Routing: ${quote.routing}`,
        quote.permitData ? "Permit data returned by the Trading API." : "No permit data requested.",
      ],
      source: "uniswap_trading_api",
    };
    return {
      message: `Best quote: ${data.amountIn} ${data.tokenIn.symbol} → ${data.amountOut} ${data.tokenOut.symbol}.`,
      data,
      swapDescription: `swap ${data.amountIn} ${data.tokenIn.symbol} for ${data.tokenOut.symbol}`,
      swap: {
        from: swapper,
        to: swapper,
        data: "0x",
        value: "0",
        chainId,
      },
    };
  }

  const quote = await quoteOnchainSwap({
    tokenIn,
    tokenOut,
    amountIn: amount,
    chainId,
  });
  const minOutWei = minOutputFor(quote, DEFAULT_SLIPPAGE_BPS);
  const data: SwapQuoteData = {
    chainId,
    chainName: chainName(chainId),
    tokenIn: { symbol: tokenIn.symbol, address: tokenIn.address, decimals: tokenIn.decimals },
    tokenOut: { symbol: tokenOut.symbol, address: tokenOut.address, decimals: tokenOut.decimals },
    amountIn: quote.amountIn,
    amountOut: quote.amountOut,
    feeTier: quote.feeTier,
    price: quote.price,
    route: `Uniswap v4 · ${tokenIn.symbol} → ${tokenOut.symbol} · ${(quote.feeTier / 10_000).toFixed(2)}%`,
    minimumOut: formatUnits(minOutWei, tokenOut.decimals),
    notes: [
      "Execution is not yet wired up for the fallback path.",
      `Default slippage: ${DEFAULT_SLIPPAGE_BPS}bps.`,
    ],
    source: "uniswap_v4",
  };
  return {
    message: `Best quote: ${quote.amountIn} ${tokenIn.symbol} → ${quote.amountOut} ${tokenOut.symbol}.`,
    data,
    swapDescription: `swap ${quote.amountIn} ${tokenIn.symbol} for ${tokenOut.symbol}`,
    swap: {
      from: swapper,
      to: swapper,
      data: "0x",
      value: "0",
      chainId,
    },
  };
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readAmount(record: Record<string, unknown>, key: string, fallback: string): string {
  const value = record[key];
  if (!value || typeof value !== "object") return fallback;
  const amount = (value as { amount?: unknown }).amount;
  return typeof amount === "string" ? amount : fallback;
}

function formatAmount(amount: string, decimals: number): string {
  try {
    return formatUnits(BigInt(amount), decimals);
  } catch {
    return amount;
  }
}

function safePrice(amountIn: string, amountOut: string): number {
  const input = Number(amountIn);
  const output = Number(amountOut);
  return input > 0 && output > 0 ? output / input : 0;
}

function minOutputFromTradingApi(amountOut: string, decimals: number, slippageBps: number): string {
  try {
    const raw = BigInt(amountOut);
    const min = (raw * BigInt(10_000 - slippageBps)) / 10_000n;
    return formatUnits(min, decimals);
  } catch {
    return amountOut;
  }
}
