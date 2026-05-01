import { chainConfig } from "@zuno/chain/config";
import type { ChainId } from "@zuno/core";
import { createPublicClient, http } from "viem";
import { arbitrum, base, mainnet, optimism } from "viem/chains";
import type { SwapReadClient } from "../types.js";

export function defaultClient(chainId: ChainId): SwapReadClient {
  const config = chainConfig(chainId);
  return createPublicClient({
    chain: viemChain(chainId),
    transport: http(config.rpcUrl),
  }) as unknown as SwapReadClient;
}

function viemChain(chainId: ChainId) {
  if (chainId === 1) return mainnet;
  if (chainId === 10) return optimism;
  if (chainId === 8453) return base;
  return arbitrum;
}
