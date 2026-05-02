import type { Address } from "@zuno/core";

/**
 * Uniswap v4 PositionManager addresses per chain.
 *
 * These mirror the canonical deployments tracked in `chainConfig` (see
 * `packages/chain/src/config/chains/index.ts`). Keep them in sync when
 * Uniswap deploys to a new chain.
 */
export const POSITION_MANAGER_BY_CHAIN: Record<number, Address> = {
  // Mainnets
  1: "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e",
  10: "0x3c3ea4b57a46241e54610e5f022e5c45859a1017",
  8453: "0x7c5f5a4bbd8fd63184577525326123b519429bdc",
  42161: "0xd88f38f930b7952f2db2432cb002e7abbf3dd869",
  // Testnets
  11155111: "0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4", // Sepolia
  84532: "0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80", // Base Sepolia
  421614: "0xAc631556d3d4019C95769033B5E719dD77124BAc", // Arbitrum Sepolia
  1301: "0xf969aee60879c54baaed9f3ed26147db216fd664", // Unichain Sepolia
};

export const MAX_UINT128 = (1n << 128n) - 1n;

export const POSITION_MANAGER_ABI = [
  {
    type: "function",
    name: "modifyLiquidities",
    inputs: [
      { type: "bytes", name: "unlockData" },
      { type: "uint256", name: "deadline" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "modifyLiquiditiesWithoutUnlock",
    inputs: [
      { type: "bytes", name: "actions" },
      { type: "bytes[]", name: "params" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;
