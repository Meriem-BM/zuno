import { chainConfig, viemChainFor } from "@zuno/chain/config";
import type { Address, ChainId, Token } from "@zuno/core";
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { MAX_UINT256 } from "./constants.js";
import type { TokenBalance, TokenReadClient } from "./types.js";

export function dedupeTokens(tokens: Token[]): Token[] {
  const seen = new Set<string>();
  const out: Token[] = [];
  for (const t of tokens) {
    const key = t.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function formatAmount(amountWei: bigint, decimals: number): string {
  if (amountWei === MAX_UINT256) return "unlimited";
  return formatUnits(amountWei, decimals);
}

export function shortAddr(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function defaultClient(chainId: ChainId): TokenReadClient {
  const config = chainConfig(chainId);
  return createPublicClient({
    chain: viemChainFor(chainId),
    transport: http(config.rpcUrl),
  }) as unknown as TokenReadClient;
}

export async function readErc20Balances(
  client: TokenReadClient,
  address: Address,
  tokens: Token[],
): Promise<TokenBalance[]> {
  if (tokens.length === 0) return [];
  const results = await client.multicall({
    contracts: tokens.map((t) => ({
      address: t.address,
      abi: erc20Abi as unknown,
      functionName: "balanceOf",
      args: [address],
    })),
    allowFailure: true,
  });

  return tokens.flatMap((t, i) => {
    const result = results[i];
    if (!result || result.status !== "success") return [];
    const raw = result.result as bigint;
    return [{ token: t, amount: formatUnits(raw, t.decimals), amountWei: raw.toString() }];
  });
}
