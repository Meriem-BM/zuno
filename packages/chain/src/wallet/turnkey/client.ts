import { chainConfig } from "@zuno/chain/config";
import type { Address, ChainId, Hex } from "@zuno/core";
import { formatUnits } from "viem";
import { userScopedClient } from "./auth.js";
import { caip2For, publicClient } from "./lib/helpers.js";
import type {
  AgentWallet,
  AgentWalletBalance,
  AgentWalletService,
  CreateAgentWalletInput,
  Session,
  TurnkeySignResult,
  TurnkeyTransactionRequest,
} from "./types.js";

export function createTurnkeyAgentWalletService(session: Session): AgentWalletService {
  return new SessionScopedTurnkeyService(session);
}

class SessionScopedTurnkeyService implements AgentWalletService {
  constructor(private readonly session: Session) {}

  async create(input: CreateAgentWalletInput): Promise<AgentWallet> {
    return this.attach(input.chainId);
  }

  async get(chainId: ChainId): Promise<AgentWallet | null> {
    if (!this.session.agentWalletAddress) return null;
    return this.attach(chainId);
  }

  async balance(wallet: AgentWallet): Promise<AgentWalletBalance> {
    const chain = chainConfig(wallet.chainId);
    const amount = await publicClient(wallet.chainId).getBalance({ address: wallet.address });
    return {
      address: wallet.address,
      chainId: wallet.chainId,
      native: { symbol: chain.nativeSymbol, amount: formatUnits(amount, 18) },
      funded: amount > 0n,
    };
  }

  async signAndSubmit(tx: TurnkeyTransactionRequest): Promise<TurnkeySignResult> {
    const apiClient = userScopedClient(this.session).apiClient();
    const result = await apiClient.ethSendTransaction({
      from: tx.from,
      // Turnkey's generated CAIP-2 typing is narrower than the set of EVM chains we support.
      caip2: caip2For(tx.chainId) as never,
      to: tx.to,
      value: tx.value,
      data: tx.data,
      sponsor: false,
    });
    const turnkeyActivityId = result.sendTransactionStatusId ?? result.activity?.id;
    // Poll Turnkey for the broadcast transaction hash. Bounded so a stuck
    // submission still returns to the caller in reasonable time.
    let transactionHash: Hex | undefined;
    if (result.sendTransactionStatusId) {
      try {
        const status = (await apiClient.pollTransactionStatus({
          sendTransactionStatusId: result.sendTransactionStatusId,
          organizationId: this.session.subOrganizationId,
          pollingIntervalMs: 1000,
          timeoutMs: 30_000,
        })) as { eth?: { txHash?: string } };
        if (status.eth?.txHash) transactionHash = status.eth.txHash as Hex;
      } catch {
        // Hash unavailable in time; fall back to activityId only.
      }
    }
    return { status: "submitted", transactionHash, turnkeyActivityId };
  }

  private attach(chainId: ChainId): AgentWallet {
    if (!this.session.agentWalletAddress) {
      throw new Error("Session does not have an agent wallet yet.");
    }
    return {
      address: this.session.agentWalletAddress as Address,
      chainId,
      provider: "turnkey",
      status: "attached",
      organizationId: this.session.subOrganizationId,
      walletId: this.session.walletId,
    };
  }
}
