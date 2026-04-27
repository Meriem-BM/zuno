import type { Address, ChainId } from "./primitives.js";

export interface Token {
  address: Address;
  symbol: string;
  decimals: number;
}

export interface Pool {
  address: Address;
  chainId: ChainId;
  token0: Token;
  token1: Token;
  feeTier: number;
  tickSpacing: number;
  currentTick: number;
  sqrtPriceX96: string;
  liquidity: string;
  // Human-readable token1/token0 price
  price: number;
}
