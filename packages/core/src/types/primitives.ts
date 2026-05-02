export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type ChainId = 1 | 10 | 8453 | 42161 | 11155111 | 84532 | 421614 | 1301;

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
