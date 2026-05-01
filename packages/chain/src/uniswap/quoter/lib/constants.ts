import type { Address } from "@zuno/core";

export const QUOTER_V2_BY_CHAIN: Record<number, Address> = {
  1: "0x61ffe014ba17989e743c5f6cb21bf9697530b21e",
  10: "0x61ffe014ba17989e743c5f6cb21bf9697530b21e",
  8453: "0x3d4e44eb1374240ce5f1b871ab261cd16335b76a",
  42161: "0x61ffe014ba17989e743c5f6cb21bf9697530b21e",
};

export const SWAP_ROUTER_BY_CHAIN: Record<number, Address> = {
  1: "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
  10: "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
  8453: "0x2626664c2603336e57b271c5c0b26f421741e481",
  42161: "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
};

export const FEE_TIER_CANDIDATES: readonly number[] = [500, 3000, 10_000];

export const QUOTER_V2_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        type: "tuple",
        name: "params",
        components: [
          { type: "address", name: "tokenIn" },
          { type: "address", name: "tokenOut" },
          { type: "uint256", name: "amountIn" },
          { type: "uint24", name: "fee" },
          { type: "uint160", name: "sqrtPriceLimitX96" },
        ],
      },
    ],
    outputs: [
      { type: "uint256", name: "amountOut" },
      { type: "uint160", name: "sqrtPriceX96After" },
      { type: "uint32", name: "initializedTicksCrossed" },
      { type: "uint256", name: "gasEstimate" },
    ],
  },
] as const;
