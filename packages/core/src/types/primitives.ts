export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type ChainId = 1 | 8453 | 42161 | 10;

export type ApprovalState = "idle" | "pending" | "approved" | "rejected";

export type ExecutionState =
  | "idle"
  | "drafted"
  | "simulated"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "signing"
  | "submitted"
  | "failed";
