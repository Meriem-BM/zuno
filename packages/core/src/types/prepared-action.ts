import type { Address, ChainId, Hex } from "./primitives.js";

export type PreparedActionKind = "approve" | "swap" | "lp_create" | "lp_add" | "lp_remove";
export type PreparedActionState =
  | "pending_review"
  | "approved"
  | "rejected"
  | "submitted"
  | "confirmed"
  | "failed";

export interface PreparedActionTransaction {
  chainId: ChainId;
  to: Address;
  data: Hex;
  value: string;
  description: string;
}

export interface PreparedActionRecord<TSummary = unknown> {
  id: string;
  kind: PreparedActionKind;
  summary: TSummary;
  transactions: PreparedActionTransaction[];
  state: PreparedActionState;
  createdAt: number;
  expiresAt: number;
  ownerAddress: Address;
  chainId: ChainId;
  transactionHash?: Hex;
  turnkeyActivityId?: string;
  notes?: string[];
}
