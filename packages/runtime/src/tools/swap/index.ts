import { chainName } from "@zuno/chain/config";
import { formatUnits } from "viem";
import { lookupToken } from "@zuno/chain/tokens";
import { minOutputFor, quoteSwap } from "@zuno/chain/uniswap";
import type { SwapQuoteData, ToolDefinition } from "../../contracts/types.js";
import { err, missingAgentWallet, ok, resolveAgentWallet } from "../shared.js";

const DEFAULT_SLIPPAGE_BPS = 50;

const prepareSwap: ToolDefinition = {
  name: "prepareSwap",
  intents: ["prepare_swap", "swap_tokens"],
  execute: async (intent, ctx) => {
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("prepareSwap");

    const tokenInSymbol = (intent.tokenSymbol ?? "eth").replace(/^eth$/u, "weth");
    const tokenOutSymbol = (intent.tokenOutSymbol ?? "").replace(/^eth$/u, "weth");
    const amount = intent.amount ?? "";

    if (!tokenOutSymbol || !amount) {
      return err(
        "prepareSwap",
        "TOKEN_UNKNOWN",
        'I need both tokens and an amount. Try: "swap 1 ETH to USDC".',
      );
    }
    const tokenIn = lookupToken(tokenInSymbol, target.chainId);
    const tokenOut = lookupToken(tokenOutSymbol, target.chainId);
    if (!tokenIn || !tokenOut) {
      return err(
        "prepareSwap",
        "TOKEN_UNKNOWN",
        `${tokenInSymbol.toUpperCase()}/${tokenOutSymbol.toUpperCase()} is not in the known token list for this chain.`,
      );
    }

    try {
      const quote = await quoteSwap({
        tokenIn,
        tokenOut,
        amountIn: amount,
        chainId: target.chainId,
      });
      const minOutWei = minOutputFor(quote, DEFAULT_SLIPPAGE_BPS);
      const data: SwapQuoteData = {
        chainId: target.chainId,
        chainName: chainName(target.chainId),
        tokenIn: { symbol: tokenIn.symbol, address: tokenIn.address, decimals: tokenIn.decimals },
        tokenOut: {
          symbol: tokenOut.symbol,
          address: tokenOut.address,
          decimals: tokenOut.decimals,
        },
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
        feeTier: quote.feeTier,
        price: quote.price,
        route: `Uniswap V3 · ${tokenIn.symbol} → ${tokenOut.symbol} · ${(quote.feeTier / 10_000).toFixed(2)}%`,
        minimumOut: formatUnits(minOutWei, tokenOut.decimals),
        notes: [
          "Execution is not yet wired up — this is a quote and route preview.",
          `Default slippage: ${DEFAULT_SLIPPAGE_BPS}bps.`,
        ],
      };
      return ok(
        "prepareSwap",
        `Best quote: ${quote.amountIn} ${tokenIn.symbol} → ${quote.amountOut} ${tokenOut.symbol}.`,
        data,
      );
    } catch (error) {
      return err(
        "prepareSwap",
        "CHAIN_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  },
};

const showQuote: ToolDefinition = {
  ...prepareSwap,
  name: "showQuote",
  intents: ["show_quote"],
};

export const SWAP_TOOLS: readonly ToolDefinition[] = [prepareSwap, showQuote];
