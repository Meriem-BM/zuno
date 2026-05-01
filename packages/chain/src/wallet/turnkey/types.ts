import type { Address, ChainId, Hex } from "@zuno/core";

export type AgentWalletProvider = "turnkey";

export type AgentWalletStatus = "missing" | "attached" | "created";

export interface AgentWallet {
  address: Address;
  chainId: ChainId;
  provider: AgentWalletProvider;
  status: AgentWalletStatus;
  organizationId?: string;
  walletId?: string;
}

export interface AgentWalletBalance {
  address: Address;
  chainId: ChainId;
  native: { symbol: string; amount: string };
  funded: boolean;
}

export interface CreateAgentWalletInput {
  chainId: ChainId;
  walletName?: string;
}

export interface TurnkeyTransactionRequest {
  from: Address;
  to: Address;
  chainId: ChainId;
  data: Hex;
  value?: string;
}

export interface TurnkeySignResult {
  status: "submitted";
  transactionHash?: Hex;
  turnkeyActivityId?: string;
}

export interface AgentWalletService {
  create(input: CreateAgentWalletInput): Promise<AgentWallet>;
  get(chainId: ChainId): Promise<AgentWallet | null>;
  balance(wallet: AgentWallet): Promise<AgentWalletBalance>;
  signAndSubmit(tx: TurnkeyTransactionRequest): Promise<TurnkeySignResult>;
}

export interface Session {
  email: string;
  subOrganizationId: string;
  agentWalletAddress?: string;
  walletId?: string;
  apiPrivateKey: string;
  apiPublicKey: string;
  expiresAt: number;
}

export interface OtpHandle {
  email: string;
  otpId: string;
}

export interface TurnkeyEnv {
  [key: string]: string | undefined;
}
