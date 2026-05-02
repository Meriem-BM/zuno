import type { Address } from "@zuno/core";

export const QUOTER_BY_CHAIN: Record<number, Address> = {
  1: "0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203",
  10: "0x1f3131a13296fb91c90870043742c3cdbff1a8d7",
  8453: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
  42161: "0x3972c00f7ed4885e145823eb7c655375d275a1c5",
};

export const FEE_TIER_CANDIDATES: readonly number[] = [500, 3000, 10_000];

export const QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        type: "tuple",
        name: "params",
        components: [
          {
            type: "tuple",
            name: "poolKey",
            components: [
              { type: "address", name: "currency0" },
              { type: "address", name: "currency1" },
              { type: "uint24", name: "fee" },
              { type: "int24", name: "tickSpacing" },
              { type: "address", name: "hooks" },
            ],
          },
          { type: "bool", name: "zeroForOne" },
          { type: "uint128", name: "exactAmount" },
          { type: "bytes", name: "hookData" },
        ],
      },
    ],
    outputs: [
      { type: "uint256", name: "amountOut" },
      { type: "uint256", name: "gasEstimate" },
    ],
  },
] as const;
