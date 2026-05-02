import type { Address, ChainId } from "@zuno/core";
import { publicClient as makePublicClient } from "../../positions/lib/helpers.js";
import { POSITION_MANAGER_BY_CHAIN } from "./constants.js";
import type { ChainClient } from "../types.js";

export function nfpmFor(chainId: ChainId): Address {
  const to = POSITION_MANAGER_BY_CHAIN[chainId];
  if (!to) throw new Error(`Uniswap v4 position manager not configured for chain ${chainId}`);
  return to;
}

export function publicClient(chainId: ChainId): ChainClient {
  return makePublicClient(chainId) as ChainClient;
}
