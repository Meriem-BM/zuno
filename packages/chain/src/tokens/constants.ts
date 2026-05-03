import type { Address, ChainId, Token } from "@zuno/core";

export const MAX_UINT256 = (1n << 256n) - 1n;

const T = (address: string, symbol: string, decimals: number): Token => ({
  address: address as Address,
  symbol,
  decimals,
});

// Native ETH in Uniswap v4 = currency address 0x0. Listing it makes pool
// discovery probe (ETH, USDC) etc. as well as (WETH, USDC), so the Strategist
// can pick a real native-ETH pool when one exists - which is the difference
// between "user has 0.05 ETH and we mint" vs "user must wrap + Permit2 dance".
const NATIVE_ETH = T("0x0000000000000000000000000000000000000000", "ETH", 18);

export const TOKEN_WHITELIST: Record<ChainId, Token[]> = {
  1: [
    NATIVE_ETH,
    T("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "USDC", 6),
    T("0xdac17f958d2ee523a2206206994597c13d831ec7", "USDT", 6),
    T("0x6b175474e89094c44da98b954eedeac495271d0f", "DAI", 18),
    T("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", "WETH", 18),
  ],
  10: [
    NATIVE_ETH,
    T("0x0b2c639c533813f4aa9d7837caf62653d097ff85", "USDC", 6),
    T("0x4200000000000000000000000000000000000006", "WETH", 18),
  ],
  8453: [
    NATIVE_ETH,
    T("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "USDC", 6),
    T("0x4200000000000000000000000000000000000006", "WETH", 18),
  ],
  42161: [
    NATIVE_ETH,
    T("0xaf88d065e77c8cc2239327c5edb3a432268e5831", "USDC", 6),
    T("0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", "USDT", 6),
    T("0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", "DAI", 18),
    T("0x82af49447d8a07e3bd95bd0d56f35241523fbab1", "WETH", 18),
  ],
  11155111: [
    NATIVE_ETH,
    // Canonical Sepolia WETH9.
    T("0xfff9976782d46cc05630d1f6ebab18b2324d6b14", "WETH", 18),
    // Circle's testnet USDC for Sepolia. Used by Uniswap's v4 demo pools.
    T("0x1c7d4b196cb0c7b01d743fbc6116a902379c7238", "USDC", 6),
    // Aave-issued Sepolia USDT (testnet faucet token used by several DeFi demos).
    T("0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0", "USDT", 6),
  ],
  84532: [
    NATIVE_ETH,
    T("0x4200000000000000000000000000000000000006", "WETH", 18),
    // Circle Base Sepolia USDC (testnet).
    T("0x036cbd53842c5426634e7929541ec2318f3dcf7e", "USDC", 6),
  ],
  421614: [
    NATIVE_ETH,
    T("0x980b62da83eff3d4576c647993b0c1d7faf17c73", "WETH", 18),
    // Circle Arbitrum Sepolia USDC (testnet).
    T("0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d", "USDC", 6),
  ],
  1301: [
    NATIVE_ETH,
    T("0x4200000000000000000000000000000000000006", "WETH", 18),
    T("0x31d0220469e10c4e71834a79b1f276d740d3768f", "USDC", 6),
  ],
};
