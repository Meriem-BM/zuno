import { chainConfig, viemChainFor } from "@zuno/chain/config";
import type { Address, ChainId, Hex, Token } from "@zuno/core";
import {
  createPublicClient,
  encodeAbiParameters,
  formatUnits,
  http,
  keccak256,
} from "viem";
import { ERC20_ABI, ZERO_ADDRESS } from "./constants.js";
import type { ContractReader } from "../types.js";

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export function publicClient(chainId: ChainId): ContractReader {
  const cfg = chainConfig(chainId);
  return createPublicClient({
    chain: viemChainFor(chainId),
    transport: http(cfg.rpcUrl),
  }) as unknown as ContractReader;
}

export function parseTokenId(id: string): bigint {
  const raw = id.trim();
  if (!/^\d+$/u.test(raw)) throw new Error(`position id must be a numeric NFT token id: ${id}`);
  return BigInt(raw);
}

export async function readToken(
  client: ContractReader,
  address: Address,
  chainId?: ChainId,
): Promise<Token> {
  if (address === ZERO_ADDRESS) {
    return {
      address,
      symbol: chainId ? chainConfig(chainId).nativeSymbol : "ETH",
      decimals: 18,
    };
  }

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

export function liquidityForAmounts(
  amount0: string,
  amount1: string,
  currentTick: number,
  tickLower: number,
  tickUpper: number,
  decimals0: number,
  decimals1: number,
): bigint {
  const raw0 = safeBigInt(amount0);
  const raw1 = safeBigInt(amount1);
  if (raw0 <= 0n && raw1 <= 0n) return 0n;

  const value0 = Number(formatUnits(raw0, decimals0));
  const value1 = Number(formatUnits(raw1, decimals1));
  if (!Number.isFinite(value0) || !Number.isFinite(value1)) return 0n;

  const sqrtLower = Math.sqrt(Math.pow(1.0001, tickLower));
  const sqrtUpper = Math.sqrt(Math.pow(1.0001, tickUpper));
  const sqrtCurrent = Math.sqrt(Math.pow(1.0001, currentTick));

  let liquidity = 0;
  if (currentTick <= tickLower) {
    liquidity = (value0 * sqrtLower * sqrtUpper) / (sqrtUpper - sqrtLower);
  } else if (currentTick < tickUpper) {
    const liquidity0 = (value0 * sqrtCurrent * sqrtUpper) / (sqrtUpper - sqrtCurrent);
    const liquidity1 = value1 / (sqrtCurrent - sqrtLower);
    liquidity = Math.min(liquidity0, liquidity1);
  } else {
    liquidity = value1 / (sqrtUpper - sqrtLower);
  }

  if (!Number.isFinite(liquidity) || liquidity <= 0) return 0n;
  return BigInt(Math.floor(liquidity));
}

export function buildPoolKey(token0: Address, token1: Address, fee: number): {
  poolKey: PoolKey;
  zeroForOne: boolean;
} {
  const lower = token0.toLowerCase() < token1.toLowerCase() ? token0 : token1;
  const upper = lower === token0 ? token1 : token0;
  return {
    poolKey: {
      currency0: lower,
      currency1: upper,
      fee,
      tickSpacing: tickSpacingForFee(fee),
      hooks: ZERO_ADDRESS,
    },
    zeroForOne: lower === token0,
  };
}

export function poolIdFor(poolKey: PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks,
      ],
    ),
  );
}

export function decodePositionInfo(info: bigint): {
  hasSubscriber: boolean;
  tickLower: number;
  tickUpper: number;
} {
  const hasSubscriber = (info & 0xffn) !== 0n;
  const tickLowerRaw = Number((info >> 8n) & 0xffffffn);
  const tickUpperRaw = Number((info >> 32n) & 0xffffffn);
  return {
    hasSubscriber,
    tickLower: signExtend24(tickLowerRaw),
    tickUpper: signExtend24(tickUpperRaw),
  };
}

function signExtend24(value: number): number {
  return value & 0x800000 ? value - 0x1000000 : value;
}

function safeBigInt(value: string): bigint {
  try {
    return BigInt(value || "0");
  } catch {
    return 0n;
  }
}
