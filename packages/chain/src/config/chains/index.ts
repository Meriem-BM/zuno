import type { Address, ChainId } from "@zuno/core";
import { loadEnvFile } from "../env/load-env.js";
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  optimism,
  sepolia,
  unichainSepolia,
} from "viem/chains";

loadEnvFile();

export interface ChainConfig {
  id: ChainId;
  name: string;
  nativeSymbol: string;
  rpcUrl?: string;
  poolManager: Address;
  positionManager: Address;
  quoter: Address;
  stateView: Address;
  permit2: Address;
}

export interface SupportedNetwork {
  chainId: ChainId;
  name: string;
  aliases: readonly string[];
}

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

export const CHAINS: Record<ChainId, ChainConfig> = {
  1: {
    id: 1,
    name: "Mainnet",
    nativeSymbol: "ETH",
    rpcUrl: process.env.ZUNO_MAINNET_RPC_URL,
    poolManager: "0x000000000004444c5dc75cB358380D2e3dE08A90",
    positionManager: "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e",
    quoter: "0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203",
    stateView: "0x7ffe42c4a5deea5b0fec41c94c136cf115597227",
    permit2: PERMIT2,
  },
  10: {
    id: 10,
    name: "Optimism",
    nativeSymbol: "ETH",
    rpcUrl: process.env.ZUNO_OPTIMISM_RPC_URL,
    poolManager: "0x9a13f98cb987694c9f086b1f5eb990eea8264ec3",
    positionManager: "0x3c3ea4b57a46241e54610e5f022e5c45859a1017",
    quoter: "0x1f3131a13296fb91c90870043742c3cdbff1a8d7",
    stateView: "0xc18a3169788f4f75a170290584eca6395c75ecdb",
    permit2: PERMIT2,
  },
  8453: {
    id: 8453,
    name: "Base",
    nativeSymbol: "ETH",
    rpcUrl: process.env.ZUNO_BASE_RPC_URL,
    poolManager: "0x498581ff718922c3f8e6a244956af099b2652b2b",
    positionManager: "0x7c5f5a4bbd8fd63184577525326123b519429bdc",
    quoter: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
    stateView: "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71",
    permit2: PERMIT2,
  },
  42161: {
    id: 42161,
    name: "Arbitrum",
    nativeSymbol: "ETH",
    rpcUrl: process.env.ZUNO_ARBITRUM_RPC_URL,
    poolManager: "0x360e68faccca8ca495c1b759fd9eee466db9fb32",
    positionManager: "0xd88f38f930b7952f2db2432cb002e7abbf3dd869",
    quoter: "0x3972c00f7ed4885e145823eb7c655375d275a1c5",
    stateView: "0x76fd297e2d437cd7f76d50f01afe6160f86e9990",
    permit2: PERMIT2,
  },
  11155111: {
    id: 11155111,
    name: "Sepolia",
    nativeSymbol: "ETH",
    rpcUrl: process.env.ZUNO_SEPOLIA_RPC_URL,
    poolManager: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
    positionManager: "0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4",
    quoter: "0x61b3f2011a92d183c7dbadbda940a7555ccf9227",
    stateView: "0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c",
    permit2: PERMIT2,
  },
  84532: {
    id: 84532,
    name: "Base Sepolia",
    nativeSymbol: "ETH",
    rpcUrl: process.env.ZUNO_BASE_SEPOLIA_RPC_URL,
    poolManager: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
    positionManager: "0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80",
    quoter: "0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba",
    stateView: "0x571291b572ed32ce6751a2cb2486ebee8defb9b4",
    permit2: PERMIT2,
  },
  421614: {
    id: 421614,
    name: "Arbitrum Sepolia",
    nativeSymbol: "ETH",
    rpcUrl: process.env.ZUNO_ARBITRUM_SEPOLIA_RPC_URL,
    poolManager: "0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317",
    positionManager: "0xAc631556d3d4019C95769033B5E719dD77124BAc",
    quoter: "0x7de51022d70a725b508085468052e25e22b5c4c9",
    stateView: "0x9d467fa9062b6e9b1a46e26007ad82db116c67cb",
    permit2: PERMIT2,
  },
  1301: {
    id: 1301,
    name: "Unichain Sepolia",
    nativeSymbol: "ETH",
    rpcUrl: process.env.ZUNO_UNICHAIN_SEPOLIA_RPC_URL,
    poolManager: "0x00b036b58a818b1bc34d502d3fe730db729e62ac",
    positionManager: "0xf969aee60879c54baaed9f3ed26147db216fd664",
    quoter: "0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472",
    stateView: "0xc199f1072a74d4e905aba1a84d9a45e2546b6222",
    permit2: PERMIT2,
  },
};

const SUPPORTED_CHAIN_IDS = new Set<ChainId>(Object.keys(CHAINS).map((id) => Number(id) as ChainId));

export const SUPPORTED_NETWORKS: readonly SupportedNetwork[] = [
  { chainId: 1, name: "Mainnet", aliases: ["mainnet", "ethereum", "eth"] },
  { chainId: 10, name: "Optimism", aliases: ["optimism", "op"] },
  { chainId: 8453, name: "Base", aliases: ["base"] },
  { chainId: 42161, name: "Arbitrum", aliases: ["arbitrum", "arb"] },
  {
    chainId: 11155111,
    name: "Sepolia",
    aliases: ["sepolia", "spolia", "ethereum sepolia", "eth sepolia"],
  },
  {
    chainId: 84532,
    name: "Base Sepolia",
    aliases: ["base sepolia", "base testnet"],
  },
  {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    aliases: ["arbitrum sepolia", "arb sepolia"],
  },
  {
    chainId: 1301,
    name: "Unichain Sepolia",
    aliases: ["unichain sepolia", "unichain testnet"],
  },
];

export function defaultChainId(): ChainId {
  const raw = Number(process.env.ZUNO_CHAIN_ID ?? 42161);
  if (SUPPORTED_CHAIN_IDS.has(raw as ChainId)) return raw as ChainId;
  throw new Error(`Unsupported ZUNO_CHAIN_ID: ${process.env.ZUNO_CHAIN_ID}`);
}

export function chainConfig(chainId: ChainId = defaultChainId()): ChainConfig {
  return CHAINS[chainId];
}

export function chainName(chainId: ChainId): string {
  return chainConfig(chainId).name;
}

export function viemChainFor(chainId: ChainId) {
  if (chainId === 1) return mainnet;
  if (chainId === 10) return optimism;
  if (chainId === 8453) return base;
  if (chainId === 42161) return arbitrum;
  if (chainId === 11155111) return sepolia;
  if (chainId === 84532) return baseSepolia;
  if (chainId === 421614) return arbitrumSepolia;
  if (chainId === 1301) return unichainSepolia;
  throw new Error(`Unsupported chain ID: ${chainId}`);
}

export function resolveNetwork(input: string): SupportedNetwork | null {
  const lower = input.toLowerCase();
  const entries = SUPPORTED_NETWORKS.flatMap((network) =>
    network.aliases.map((alias) => ({ network, alias })),
  ).sort((a, b) => b.alias.length - a.alias.length);

  for (const { network, alias } of entries) {
    if (alias.includes(" ")) {
      if (lower.includes(alias)) return network;
      continue;
    }
    if (new RegExp(`\\b${escapeRegExp(alias)}\\b`, "iu").test(lower)) return network;
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function monitorIntervalMs(): number {
  const raw = Number(process.env.ZUNO_MONITOR_INTERVAL_MS ?? 60_000);
  if (!Number.isFinite(raw) || raw < 5_000) {
    throw new Error("ZUNO_MONITOR_INTERVAL_MS must be at least 5000.");
  }
  return raw;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  apiBaseUrl: string;
}

export function telegramConfig(): TelegramConfig | null {
  const botToken = process.env.ZUNO_TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.ZUNO_TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) return null;
  return {
    botToken,
    chatId,
    apiBaseUrl: process.env.ZUNO_TELEGRAM_API_BASE_URL?.trim() || "https://api.telegram.org",
  };
}
