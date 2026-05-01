import type { Address, ChainId, Hex, Token } from "@zuno/core";

export interface TokenReadClient {
  getBalance(args: { address: Address }): Promise<bigint>;
  multicall(args: {
    contracts: ReadonlyArray<{
      address: Address;
      abi: unknown;
      functionName: string;
      args: readonly unknown[];
    }>;
    allowFailure: boolean;
  }): Promise<TokenMulticallResult[]>;
  readContract(args: {
    address: Address;
    abi: unknown;
    functionName: string;
    args: readonly unknown[];
  }): Promise<unknown>;
}

export interface TokenMulticallResult {
  status: "success" | "failure";
  result?: unknown;
}

export interface NativeBalance {
  symbol: string;
  amount: string;
  amountWei: string;
}

export interface TokenBalance {
  token: Token;
  amount: string;
  amountWei: string;
}

export interface BalanceSnapshot {
  address: Address;
  chainId: ChainId;
  chainName: string;
  native: NativeBalance;
  tokens: TokenBalance[];
}

export interface FetchBalancesOptions {
  /** Additional ERC20s to read alongside the per-chain whitelist. */
  extraTokens?: Token[];
  client?: TokenReadClient;
}

export interface AllowanceQuery {
  token: Token;
  owner: Address;
  spender: Address;
  chainId: ChainId;
}

export interface AllowanceReading {
  token: Token;
  owner: Address;
  spender: Address;
  chainId: ChainId;
  allowanceWei: string;
  allowance: string;
  /** True iff the allowance is at least `requiredWei` (when supplied). */
  sufficient?: boolean;
  requiredWei?: string;
}

export interface ApprovalRequirement {
  token: Token;
  owner: Address;
  spender: Address;
  chainId: ChainId;
  currentAllowanceWei: string;
  requiredWei: string;
  needsApproval: boolean;
}

export interface ApprovalTransaction {
  chainId: ChainId;
  to: Address;
  data: Hex;
  value: string;
  description: string;
}

export interface ReadAllowanceOptions {
  client?: TokenReadClient;
  /** When provided, the result records sufficiency vs this required amount. */
  requiredWei?: bigint;
}
