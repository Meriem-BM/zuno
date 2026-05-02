import { chainConfig, viemChainFor } from "@zuno/chain/config";
import type { ChainId } from "@zuno/core";
import { createPublicClient, http } from "viem";
import type { SwapReadClient } from "../types.js";

export function defaultClient(chainId: ChainId): SwapReadClient {
  const config = chainConfig(chainId);
  return createPublicClient({
    chain: viemChainFor(chainId),
    transport: http(config.rpcUrl),
  }) as unknown as SwapReadClient;
}
