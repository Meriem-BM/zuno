import type { Address, ChainId, Hex, Position, Token } from "@zuno/core";
import type { ContractReader } from "../positions/types.js";

export interface PreparedTx {
  chainId: ChainId;
  to: Address;
  data: Hex;
  value: string;
  description: string;
}

export interface ChainClient extends ContractReader {
  estimateGas(args: { account: Address; to: Address; data: Hex; value?: bigint }): Promise<bigint>;
}

export interface MintParams {
  token0: Token;
  token1: Token;
  fee: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: string;
  amount1Desired: string;
  amount0Min: string;
  amount1Min: string;
  recipient: Address;
  deadline: number;
  chainId: ChainId;
}

export interface IncreaseLiquidityParams {
  tokenId: bigint;
  amount0Desired: string;
  amount1Desired: string;
  amount0Min: string;
  amount1Min: string;
  deadline: number;
  chainId: ChainId;
}

export interface DecreaseLiquidityParams {
  tokenId: bigint;
  liquidity: bigint;
  amount0Min: string;
  amount1Min: string;
  deadline: number;
  chainId: ChainId;
}

export interface CollectParams {
  tokenId: bigint;
  recipient: Address;
  amount0Max: string;
  amount1Max: string;
  chainId: ChainId;
}

export interface BurnParams {
  tokenId: bigint;
  chainId: ChainId;
}

export interface RebalanceCalldataInput {
  position: Position;
  liquidity: bigint;
  newTickLower: number;
  newTickUpper: number;
  amount0Desired: string;
  amount1Desired: string;
  amount0Min: string;
  amount1Min: string;
  removeAmount0Min?: string;
  removeAmount1Min?: string;
  recipient: Address;
  deadlineSeconds?: number;
}

export interface TransactionSimulation {
  ok: boolean;
  gasUnits?: string;
  reason?: string;
}
