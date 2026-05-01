import type { Address } from "@zuno/core";

export const NFPM_BY_CHAIN: Record<number, Address> = {
  1: "0xc36442b4a4522e871399cd717abdd847ab11fe88",
  10: "0xc36442b4a4522e871399cd717abdd847ab11fe88",
  8453: "0x03a520b32c04bf3beef7beb72e919cf822ed34f1",
  42161: "0xc36442b4a4522e871399cd717abdd847ab11fe88",
};

export const MAX_UINT128 = (1n << 128n) - 1n;

export const NFPM_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      {
        type: "tuple",
        name: "params",
        components: [
          { type: "address", name: "token0" },
          { type: "address", name: "token1" },
          { type: "uint24", name: "fee" },
          { type: "int24", name: "tickLower" },
          { type: "int24", name: "tickUpper" },
          { type: "uint256", name: "amount0Desired" },
          { type: "uint256", name: "amount1Desired" },
          { type: "uint256", name: "amount0Min" },
          { type: "uint256", name: "amount1Min" },
          { type: "address", name: "recipient" },
          { type: "uint256", name: "deadline" },
        ],
      },
    ],
    outputs: [
      { type: "uint256", name: "tokenId" },
      { type: "uint128", name: "liquidity" },
      { type: "uint256", name: "amount0" },
      { type: "uint256", name: "amount1" },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "increaseLiquidity",
    inputs: [
      {
        type: "tuple",
        name: "params",
        components: [
          { type: "uint256", name: "tokenId" },
          { type: "uint256", name: "amount0Desired" },
          { type: "uint256", name: "amount1Desired" },
          { type: "uint256", name: "amount0Min" },
          { type: "uint256", name: "amount1Min" },
          { type: "uint256", name: "deadline" },
        ],
      },
    ],
    outputs: [
      { type: "uint128", name: "liquidity" },
      { type: "uint256", name: "amount0" },
      { type: "uint256", name: "amount1" },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "decreaseLiquidity",
    inputs: [
      {
        type: "tuple",
        name: "params",
        components: [
          { type: "uint256", name: "tokenId" },
          { type: "uint128", name: "liquidity" },
          { type: "uint256", name: "amount0Min" },
          { type: "uint256", name: "amount1Min" },
          { type: "uint256", name: "deadline" },
        ],
      },
    ],
    outputs: [
      { type: "uint256", name: "amount0" },
      { type: "uint256", name: "amount1" },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "collect",
    inputs: [
      {
        type: "tuple",
        name: "params",
        components: [
          { type: "uint256", name: "tokenId" },
          { type: "address", name: "recipient" },
          { type: "uint128", name: "amount0Max" },
          { type: "uint128", name: "amount1Max" },
        ],
      },
    ],
    outputs: [
      { type: "uint256", name: "amount0" },
      { type: "uint256", name: "amount1" },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "burn",
    inputs: [{ type: "uint256", name: "tokenId" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "multicall",
    inputs: [{ type: "bytes[]", name: "data" }],
    outputs: [{ type: "bytes[]", name: "results" }],
    stateMutability: "payable",
  },
] as const;
