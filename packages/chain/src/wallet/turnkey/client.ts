import { chainConfig } from "@zuno/chain/config";
import type { Address, ChainId, Hex } from "@zuno/core";
import { formatUnits, serializeTransaction } from "viem";
import { userScopedClient } from "./auth.js";
import { publicClient } from "./lib/helpers.js";
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
    const client = publicClient(tx.chainId);

    const value = tx.value ? BigInt(tx.value) : 0n;
    const [nonce, fees, gasLimit] = await Promise.all([
      client.getTransactionCount({ address: tx.from, blockTag: "pending" }),
      client.estimateFeesPerGas(),
      client.estimateGas({
        account: tx.from,
        to: tx.to,
        data: tx.data,
        value,
      }),
    ]);

    const unsignedSerialized = serializeTransaction({
      chainId: tx.chainId,
      type: "eip1559",
      to: tx.to,
      data: tx.data,
      value,
      nonce: Number(nonce),
      gas: gasLimit,
      maxFeePerGas: fees.maxFeePerGas ?? 0n,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? 0n,
    });

    const signResult = await apiClient.signTransaction({
      signWith: tx.from,
      unsignedTransaction: unsignedSerialized.replace(/^0x/, ""),
      type: "TRANSACTION_TYPE_ETHEREUM",
    });

    const signedHex = `0x${signResult.signedTransaction.replace(/^0x/, "")}` as Hex;
    const transactionHash = await client.sendRawTransaction({ serializedTransaction: signedHex });
    const turnkeyActivityId = signResult.activity?.id;

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
