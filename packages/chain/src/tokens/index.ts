import { chainConfig } from "@zuno/chain/config";
import type { Address, ChainId, Token } from "@zuno/core";
import { encodeFunctionData, erc20Abi, formatUnits } from "viem";
import { TOKEN_WHITELIST } from "./constants.js";
import {
  dedupeTokens,
  defaultClient,
  formatAmount,
  readErc20Balances,
  shortAddr,
} from "./helpers.js";
import type {
  AllowanceQuery,
  AllowanceReading,
  ApprovalRequirement,
  ApprovalTransaction,
  BalanceSnapshot,
  FetchBalancesOptions,
  Permit2AllowanceReading,
  Permit2ApprovalRequirement,
  ReadAllowanceOptions,
  TokenReadClient,
} from "./types.js";

export * from "./constants.js";
export * from "./types.js";

export function lookupToken(symbol: string, chainId: ChainId): Token | null {
  const list = TOKEN_WHITELIST[chainId];
  if (!list) return null;
  const lower = symbol.toLowerCase();
  return list.find((t) => t.symbol.toLowerCase() === lower) ?? null;
}

export async function fetchBalances(
  address: Address,
  chainId: ChainId,
  options: FetchBalancesOptions = {},
): Promise<BalanceSnapshot> {
  const chain = chainConfig(chainId);
  const client = options.client ?? defaultClient(chainId);

  const native = await client.getBalance({ address });
  const tokens = dedupeTokens([
    ...(TOKEN_WHITELIST[chainId] ?? []),
    ...(options.extraTokens ?? []),
  ]);
  const tokenBalances = await readErc20Balances(client, address, tokens);

  return {
    address,
    chainId,
    chainName: chain.name,
    native: {
      symbol: chain.nativeSymbol,
      amount: formatUnits(native, 18),
      amountWei: native.toString(),
    },
    tokens: tokenBalances,
  };
}

export async function readAllowance(
  query: AllowanceQuery,
  options: ReadAllowanceOptions = {},
): Promise<AllowanceReading> {
  const client = options.client ?? defaultClient(query.chainId);
  const allowanceWei = (await client.readContract({
    address: query.token.address,
    abi: erc20Abi as unknown,
    functionName: "allowance",
    args: [query.owner, query.spender],
  })) as bigint;

  const reading: AllowanceReading = {
    token: query.token,
    owner: query.owner,
    spender: query.spender,
    chainId: query.chainId,
    allowanceWei: allowanceWei.toString(),
    allowance: formatUnits(allowanceWei, query.token.decimals),
  };

  if (options.requiredWei !== undefined) {
    reading.sufficient = allowanceWei >= options.requiredWei;
    reading.requiredWei = options.requiredWei.toString();
  }
  return reading;
}

export async function readAllowances(
  queries: AllowanceQuery[],
  options: { client?: TokenReadClient } = {},
): Promise<AllowanceReading[]> {
  return Promise.all(queries.map((q) => readAllowance(q, { client: options.client })));
}

export async function checkApprovalRequirement(
  query: AllowanceQuery,
  requiredWei: bigint,
  options: { client?: TokenReadClient } = {},
): Promise<ApprovalRequirement> {
  const reading = await readAllowance(query, { client: options.client, requiredWei });
  return {
    token: query.token,
    owner: query.owner,
    spender: query.spender,
    chainId: query.chainId,
    currentAllowanceWei: reading.allowanceWei,
    requiredWei: requiredWei.toString(),
    needsApproval: !reading.sufficient,
  };
}

const PERMIT2_ALLOWANCE_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
] as const;

export async function readPermit2Allowance(
  query: AllowanceQuery,
  options: ReadAllowanceOptions = {},
): Promise<Permit2AllowanceReading> {
  const client = options.client ?? defaultClient(query.chainId);
  const permit2 = chainConfig(query.chainId).permit2;
  const result = await client.readContract({
    address: permit2,
    abi: PERMIT2_ALLOWANCE_ABI,
    functionName: "allowance",
    args: [query.owner, query.token.address, query.spender],
  });
  const { amount, expiration, nonce } = parsePermit2Allowance(result);
  const expired = amount > 0n && expiration <= Math.floor(Date.now() / 1000);

  const reading: Permit2AllowanceReading = {
    token: query.token,
    owner: query.owner,
    spender: query.spender,
    chainId: query.chainId,
    allowanceWei: amount.toString(),
    expiration,
    nonce,
    expired,
  };

  if (options.requiredWei !== undefined) {
    reading.sufficient = amount >= options.requiredWei && !expired;
    reading.requiredWei = options.requiredWei.toString();
  }
  return reading;
}

export async function checkPermit2ApprovalRequirement(
  query: AllowanceQuery,
  requiredWei: bigint,
  options: { client?: TokenReadClient } = {},
): Promise<Permit2ApprovalRequirement> {
  const reading = await readPermit2Allowance(query, {
    client: options.client,
    requiredWei,
  });
  return {
    token: query.token,
    owner: query.owner,
    spender: query.spender,
    chainId: query.chainId,
    currentAllowanceWei: reading.allowanceWei,
    expiration: reading.expiration,
    requiredWei: requiredWei.toString(),
    needsApproval: !reading.sufficient,
    expired: Boolean(reading.expired),
  };
}

export function buildApproveTransaction(
  token: Token,
  spender: Address,
  amountWei: bigint,
  chainId: ChainId,
): ApprovalTransaction {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amountWei],
  });
  return {
    chainId,
    to: token.address,
    data,
    value: "0",
    description: `approve ${formatAmount(amountWei, token.decimals)} ${token.symbol} for ${shortAddr(spender)}`,
  };
}

function parsePermit2Allowance(result: unknown): {
  amount: bigint;
  expiration: number;
  nonce: number;
} {
  if (Array.isArray(result)) {
    return {
      amount: BigInt(result[0] as bigint | number | string),
      expiration: Number(result[1]),
      nonce: Number(result[2]),
    };
  }
  if (result && typeof result === "object") {
    const record = result as { amount?: unknown; expiration?: unknown; nonce?: unknown };
    return {
      amount: BigInt(record.amount as bigint | number | string),
      expiration: Number(record.expiration),
      nonce: Number(record.nonce),
    };
  }
  throw new Error("Unexpected Permit2 allowance response.");
}
