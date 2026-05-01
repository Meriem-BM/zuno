import { chainConfig } from "@zuno/chain/config";
import type { Address, ChainId, Token } from "@zuno/core";
import { createPublicClient, http } from "viem";
import { arbitrum, base, mainnet, optimism } from "viem/chains";
import { ERC20_ABI } from "./constants.js";
import type { ContractReader } from "../types.js";

export function publicClient(chainId: ChainId): ContractReader {
  const cfg = chainConfig(chainId);
  const chain = { 1: mainnet, 10: optimism, 8453: base, 42161: arbitrum }[chainId];
  return createPublicClient({ chain, transport: http(cfg.rpcUrl) }) as unknown as ContractReader;
}

export function parseTokenId(id: string): bigint {
  const raw = id.trim();
  if (!/^\d+$/u.test(raw)) throw new Error(`position id must be a numeric NFT token id: ${id}`);
  return BigInt(raw);
}

export async function readToken(client: ContractReader, address: Address): Promise<Token> {
  const [symbol, decimals] = await Promise.all([
    client.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }),
    client.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }),
  ]);
  return { address, symbol: String(symbol), decimals: Number(decimals) };
}

export function tickSpacingForFee(fee: number): number {
  const spacing: Record<number, number> = { 100: 1, 500: 10, 3000: 60, 10000: 200 };
  return spacing[fee] ?? 1;
}

export function estimateAmounts(
  liquidity: bigint,
  currentTick: number,
  tickLower: number,
  tickUpper: number,
): { amount0: string; amount1: string } {
  const l = Number(liquidity);
  if (!Number.isFinite(l) || l <= 0) return { amount0: "0", amount1: "0" };

  const sqrtLower = Math.sqrt(Math.pow(1.0001, tickLower));
  const sqrtUpper = Math.sqrt(Math.pow(1.0001, tickUpper));
  const sqrtCurrent = Math.sqrt(Math.pow(1.0001, currentTick));

  let amount0 = 0;
  let amount1 = 0;
  if (currentTick <= tickLower) {
    amount0 = (l * (sqrtUpper - sqrtLower)) / (sqrtLower * sqrtUpper);
  } else if (currentTick < tickUpper) {
    amount0 = (l * (sqrtUpper - sqrtCurrent)) / (sqrtCurrent * sqrtUpper);
    amount1 = l * (sqrtCurrent - sqrtLower);
  } else {
    amount1 = l * (sqrtUpper - sqrtLower);
  }

  return {
    amount0: Math.max(0, Math.floor(amount0)).toString(),
    amount1: Math.max(0, Math.floor(amount1)).toString(),
  };
}
