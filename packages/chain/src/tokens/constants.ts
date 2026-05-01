import type { Address, ChainId, Token } from "@zuno/core";

export const MAX_UINT256 = (1n << 256n) - 1n;

const T = (address: string, symbol: string, decimals: number): Token => ({
  address: address as Address,
  symbol,
  decimals,
});

export const TOKEN_WHITELIST: Record<ChainId, Token[]> = {
  1: [
    T("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "USDC", 6),
    T("0xdac17f958d2ee523a2206206994597c13d831ec7", "USDT", 6),
    T("0x6b175474e89094c44da98b954eedeac495271d0f", "DAI", 18),
    T("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", "WETH", 18),
  ],
  10: [
    T("0x0b2c639c533813f4aa9d7837caf62653d097ff85", "USDC", 6),
    T("0x4200000000000000000000000000000000000006", "WETH", 18),
  ],
  8453: [
    T("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "USDC", 6),
    T("0x4200000000000000000000000000000000000006", "WETH", 18),
  ],
  42161: [
    T("0xaf88d065e77c8cc2239327c5edb3a432268e5831", "USDC", 6),
    T("0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", "USDT", 6),
    T("0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", "DAI", 18),
    T("0x82af49447d8a07e3bd95bd0d56f35241523fbab1", "WETH", 18),
  ],
};
