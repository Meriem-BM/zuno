import type { Address, ChainId, SignerMode } from "@zuno/core";

export interface ConnectedWallet {
  address: Address;
  chainId: ChainId;
  chainName: string;
  signerMode: SignerMode;
}

export type WalletErrorCode =
  | "WALLET_CONNECTION_CANCELLED"
  | "WALLET_CONNECTION_TIMEOUT"
  | "WALLET_CONNECTION_FAILED";

export class WalletConnectionError extends Error {
  readonly code: WalletErrorCode;
  constructor(code: WalletErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "WalletConnectionError";
  }
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

export type ConnectWalletOutcome =
  | { status: "connected"; wallet: ConnectedWallet; message: string }
  | { status: "already_connected"; wallet: ConnectedWallet; message: string }
  | { status: "error"; errorCode: WalletErrorCode; message: string };
