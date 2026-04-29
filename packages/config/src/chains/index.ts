import type { Address, ChainId } from "@zuno/core";
import { loadEnvFile } from "../env/load-env.js";

loadEnvFile();

export interface ChainConfig {
  id: ChainId;
  name: string;
  nativeSymbol: string;
  rpcUrl?: string;
  uniswapV3Factory: Address;
  nonfungiblePositionManager: Address;
}

const NFPM = "0xc36442b4a4522e871399cd717abdd847ab11fe88" as const;

export const CHAINS: Record<ChainId, ChainConfig> = {
  1: {
    id: 1,
    name: "Mainnet",
    nativeSymbol: "ETH",
    rpcUrl: process.env.ZUNO_MAINNET_RPC_URL,
    uniswapV3Factory: "0x1f98431c8ad98523631ae4a59f267346ea31f984",
    nonfungiblePositionManager: NFPM,
  },
  10: {
    id: 10,
    name: "Optimism",
    nativeSymbol: "ETH",
    rpcUrl: process.env.ZUNO_OPTIMISM_RPC_URL,
    uniswapV3Factory: "0x1f98431c8ad98523631ae4a59f267346ea31f984",
    nonfungiblePositionManager: NFPM,
  },
  8453: {
    id: 8453,
    name: "Base",
    nativeSymbol: "ETH",
    rpcUrl: process.env.ZUNO_BASE_RPC_URL,
    uniswapV3Factory: "0x33128a8fc17869897dce68ed026d694621f6fdfd",
    nonfungiblePositionManager: NFPM,
  },
  42161: {
    id: 42161,
    name: "Arbitrum",
    nativeSymbol: "ETH",
    rpcUrl: process.env.ZUNO_ARBITRUM_RPC_URL,
    uniswapV3Factory: "0x1f98431c8ad98523631ae4a59f267346ea31f984",
    nonfungiblePositionManager: NFPM,
  },
};

export function defaultChainId(): ChainId {
  const raw = Number(process.env.ZUNO_CHAIN_ID ?? 42161);
  if (raw === 1 || raw === 10 || raw === 8453 || raw === 42161) return raw;
  throw new Error(`Unsupported ZUNO_CHAIN_ID: ${process.env.ZUNO_CHAIN_ID}`);
}

export function configuredWatchAddress(): Address | null {
  const raw = process.env.ZUNO_WATCH_ADDRESS ?? process.env.ZUNO_WALLET_ADDRESS;
  if (!raw) return null;
  return raw as Address;
}

export function chainConfig(chainId: ChainId = defaultChainId()): ChainConfig {
  return CHAINS[chainId];
}

export function chainName(chainId: ChainId): string {
  return chainConfig(chainId).name;
}

export function explorerTxUrl(chainId: ChainId, txHash: string): string | undefined {
  const bases: Partial<Record<ChainId, string>> = {
    1: "https://etherscan.io/tx",
    10: "https://optimistic.etherscan.io/tx",
    8453: "https://basescan.org/tx",
    42161: "https://arbiscan.io/tx",
  };
  const base = bases[chainId];
  return base ? `${base}/${txHash}` : undefined;
}

export function monitorIntervalMs(): number {
  const raw = Number(process.env.ZUNO_MONITOR_INTERVAL_MS ?? 60_000);
  if (!Number.isFinite(raw) || raw < 5_000) {
    throw new Error("ZUNO_MONITOR_INTERVAL_MS must be at least 5000.");
  }
  return raw;
}
