import type { Address, ChainId } from "@zuno/core";
import { publicClient as makePublicClient } from "../../positions/lib/helpers.js";
import { NFPM_BY_CHAIN } from "./constants.js";
import type { ChainClient } from "../types.js";

export function nfpmFor(chainId: ChainId): Address {
  const to = NFPM_BY_CHAIN[chainId];
  if (!to) throw new Error(`Uniswap V3 NFT manager not configured for chain ${chainId}`);
  return to;
}

export function publicClient(chainId: ChainId): ChainClient {
  return makePublicClient(chainId) as ChainClient;
}
