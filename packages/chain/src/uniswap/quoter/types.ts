import type { Address, ChainId, Token } from "@zuno/core";

export interface SwapQuote {
  chainId: ChainId;
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountInWei: string;
  amountOut: string;
  amountOutWei: string;
  feeTier: number;
  /** Effective price = amountOut / amountIn, expressed as tokenOut per tokenIn. */
  price: number;
  source: "uniswap_v3";
}

export interface QuoteSwapInput {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  chainId: ChainId;
  /** Restrict the candidate fee tiers (default 0.05% / 0.30% / 1.00%). */
  feeTiers?: readonly number[];
}

export interface QuoteSwapOptions {
  client?: SwapReadClient;
}

/**
 * Minimal subset of viem's PublicClient — same trick used in `@zuno/chain/tokens`.
 */
export interface SwapReadClient {
  readContract(args: {
    address: Address;
    abi: unknown;
    functionName: string;
    args: readonly unknown[];
  }): Promise<unknown>;
}
