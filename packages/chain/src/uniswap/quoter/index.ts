import { formatUnits, parseUnits } from "viem";
import { FEE_TIER_CANDIDATES, QUOTER_V2_ABI, QUOTER_V2_BY_CHAIN } from "./lib/constants.js";
import { defaultClient } from "./lib/helpers.js";
import type { QuoteSwapInput, QuoteSwapOptions, SwapQuote } from "./types.js";

export * from "./lib/constants.js";
export * from "./types.js";

export async function quoteSwap(
  input: QuoteSwapInput,
  options: QuoteSwapOptions = {},
): Promise<SwapQuote> {
  const quoter = QUOTER_V2_BY_CHAIN[input.chainId];
  if (!quoter) {
    throw new Error(`Uniswap V3 QuoterV2 not configured for chain ${input.chainId}`);
  }
  const client = options.client ?? defaultClient(input.chainId);
  const tiers = input.feeTiers ?? FEE_TIER_CANDIDATES;
  const amountInWei = parseUnits(input.amountIn, input.tokenIn.decimals);

  let best: { amountOut: bigint; fee: number } | null = null;
  for (const fee of tiers) {
    try {
      const result = (await client.readContract({
        address: quoter,
        abi: QUOTER_V2_ABI as unknown,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: input.tokenIn.address,
            tokenOut: input.tokenOut.address,
            amountIn: amountInWei,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      })) as [bigint, bigint, number, bigint];
      const amountOut = result[0];
      if (!best || amountOut > best.amountOut) best = { amountOut, fee };
    } catch {}
  }

  if (!best || best.amountOut === 0n) {
    throw new Error(
      `No Uniswap V3 pool found for ${input.tokenIn.symbol}/${input.tokenOut.symbol} on chain ${input.chainId}`,
    );
  }

  const amountOut = formatUnits(best.amountOut, input.tokenOut.decimals);
  const amountIn = formatUnits(amountInWei, input.tokenIn.decimals);
  const price =
    Number(amountOut) > 0 && Number(amountIn) > 0 ? Number(amountOut) / Number(amountIn) : 0;

  return {
    chainId: input.chainId,
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    amountIn,
    amountInWei: amountInWei.toString(),
    amountOut,
    amountOutWei: best.amountOut.toString(),
    feeTier: best.fee,
    price,
    source: "uniswap_v3",
  };
}

export function minOutputFor(quote: SwapQuote, slippageBps: number): bigint {
  const amountOut = BigInt(quote.amountOutWei);
  if (slippageBps <= 0) return amountOut;
  return (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
}
