import type { Address, ChainId, SignerMode } from "../types/primitives.js";

export interface SessionState {
  watchAddress: Address | null;
  walletAddress: Address | null;
  chainId: ChainId | null;
  lastPositionId: string | null;
  lastPlanId: string | null;
  lastIntent: string | null;
  signerMode: SignerMode | null;
}

export interface SessionStore {
  get(): SessionState;
  update(patch: Partial<SessionState>): SessionState;
  reset(): SessionState;
}

const empty = (): SessionState => ({
  watchAddress: null,
  walletAddress: null,
  chainId: null,
  lastPositionId: null,
  lastPlanId: null,
  lastIntent: null,
  signerMode: null,
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
