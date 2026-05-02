import type { ChainId } from "@zuno/core";
import { chainConfig, viemChainFor } from "@zuno/chain/config";
import { createPublicClient, http } from "viem";
import { REBALANCE_GAS_UNITS } from "./constants.js";

// Live gas oracle: eth_gasPrice + 30s per-chain cache, with chain-specific
// defaults when the RPC is unavailable. The `source` string lets the critic
// quote provenance to the user.

interface CachedGas {
  fetchedAt: number;
  gwei: number;
  source: string;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<ChainId, CachedGas>();

const DEFAULTS: Record<number, number> = {
  1: 18,
  10: 0.001,
  137: 60,
  8453: 0.04,
  42161: 0.05,
};

export interface GasReading {
  chainId: ChainId;
  gwei: number;
  source: string;
}

export async function readGasGwei(chainId: ChainId): Promise<GasReading> {
  const cached = cache.get(chainId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { chainId, gwei: cached.gwei, source: cached.source };
  }

  try {
    const cfg = chainConfig(chainId);
    const client = createPublicClient({
      chain: viemChainFor(chainId),
      transport: http(cfg.rpcUrl),
    });
    const wei = await client.getGasPrice();
    const gwei = Number(wei) / 1e9;
    if (!Number.isFinite(gwei) || gwei <= 0) throw new Error("invalid gwei");
    const reading = { chainId, gwei, source: "rpc:eth_gasPrice" };
    cache.set(chainId, { fetchedAt: Date.now(), gwei, source: reading.source });
    return reading;
  } catch {
    const gwei = DEFAULTS[chainId] ?? 5;
    return { chainId, gwei, source: "fallback:chain-default" };
  }
}

// USD cost of a typical Uniswap rebalance (mint + collect + swap).
export function rebalanceCostUsd(gasGwei: number, ethPriceUsd: number): number {
  const ethCost = (REBALANCE_GAS_UNITS * gasGwei) / 1e9;
  return ethCost * ethPriceUsd;
}
