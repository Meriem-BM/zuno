import type { Address, ApprovalState, ChainId, ExecutionState } from "../types/primitives.js";

export interface SessionState {
  userWalletAddress: Address | null;
  agentWalletAddress: Address | null;
  chainId: ChainId | null;
  lastPositionId: string | null;
  lastPlanId: string | null;
  lastIntent: string | null;
  approvalState: ApprovalState | null;
  executionState: ExecutionState | null;
}

export interface SessionStore {
  get(): SessionState;
  update(patch: Partial<SessionState>): SessionState;
  reset(): SessionState;
}

const empty = (): SessionState => ({
  userWalletAddress: null,
  agentWalletAddress: null,
  chainId: null,
  lastPositionId: null,
  lastPlanId: null,
  lastIntent: null,
  approvalState: "idle",
  executionState: "idle",
});

export function createSession(initial: Partial<SessionState> = {}): SessionStore {
  let state: SessionState = { ...empty(), ...initial };

  return {
    get: () => state,
    update: (patch) => {
      state = { ...state, ...patch };
      return state;
    },
    reset: () => {
      state = empty();
      return state;
    },
  };
}
