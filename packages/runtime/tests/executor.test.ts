import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionState } from "@zuno/core";
import type { Intent, IntentKind } from "@zuno/intents";
import { executeIntent } from "../src/executor.js";
import { TOOLS } from "../src/tools/index.js";
import type {
  ApplyPlanData,
  ConnectWalletData,
  InspectPositionData,
  RecommendRebalanceData,
  ToolDefinition,
} from "../src/types.js";

const emptySession: SessionState = {
  walletAddress: null,
  chainId: null,
  lastPositionId: null,
  lastPlanId: null,
  lastIntent: null,
  signerMode: null,
};

const session = (patch: Partial<SessionState> = {}): SessionState => ({
  ...emptySession,
  ...patch,
});

const intent = (kind: IntentKind, fields: Partial<Intent> = {}): Intent => ({
  intent: kind,
  rawInput: kind,
  confidence: 0.9,
  ...fields,
});

const ctx = (s: SessionState = emptySession) => ({ session: s, tools: TOOLS });

describe("executeIntent — intent-to-tool mapping", () => {
  it("maps every actionable intent to exactly one tool", () => {
    const actionable: IntentKind[] = [
      "connect_wallet",
      "show_balance",
      "list_positions",
      "inspect_position",
      "inspect_all_positions",
      "check_range_status",
      "list_out_of_range_positions",
      "list_risky_positions",
      "recommend_rebalance",
      "show_rebalance_options",
      "explain_recommendation",
      "show_diff",
      "simulate_plan",
      "apply_plan",
      "agent_status",
      "show_peers",
      "show_logs",
    ];
    for (const kind of actionable) {
      const matches = TOOLS.filter((t) => t.intents.includes(kind));
      assert.equal(matches.length, 1, `intent ${kind} → ${matches.length} tools`);
    }
  });

  it("does not register tools for non-actionable intents", () => {
    const nonActionable: IntentKind[] = ["exit", "help", "unknown", "needs_clarification"];
    for (const kind of nonActionable) {
      const matches = TOOLS.filter((t) => t.intents.includes(kind));
      assert.equal(matches.length, 0, `intent ${kind} → ${matches.length} tools (expected 0)`);
    }
  });
});

describe("executeIntent — non-actionable intents", () => {
  it("returns INTENT_NOT_ACTIONABLE for help / exit / unknown / needs_clarification", async () => {
    for (const kind of ["help", "exit", "unknown", "needs_clarification"] as const) {
      const { result, session: next } = await executeIntent(intent(kind), ctx());
      assert.equal(result.status, "error");
      assert.equal(result.errorCode, "INTENT_NOT_ACTIONABLE");
      assert.equal(next.lastIntent, null, "session must not be touched");
    }
  });
});

describe("executeIntent — successful execution", () => {
  it("connect_wallet returns wallet data and updates session", async () => {
    const { result, session: next } = await executeIntent(
      intent("connect_wallet"),
      ctx(),
    );
    assert.equal(result.status, "success");
    assert.equal(result.tool, "connectWallet");
    const data = result.data as ConnectWalletData;
    assert.match(data.walletAddress, /^0x[a-f0-9]{40}$/);
    assert.equal(next.walletAddress, data.walletAddress);
    assert.equal(next.chainId, data.chainId);
    assert.equal(next.signerMode, data.signerMode);
    assert.equal(next.lastIntent, "connect_wallet");
  });

  it("inspect_position returns the position and sets lastPositionId", async () => {
    const { result, session: next } = await executeIntent(
      intent("inspect_position", { positionId: "42" }),
      ctx(),
    );
    assert.equal(result.status, "success");
    const data = result.data as InspectPositionData;
    assert.equal(data.positionId, "42");
    assert.equal(next.lastPositionId, "42");
    assert.equal(next.lastIntent, "inspect_position");
  });

  it("recommend_rebalance produces a planId and writes it to session", async () => {
    const { result, session: next } = await executeIntent(
      intent("recommend_rebalance", { positionId: "77" }),
      ctx(),
    );
    assert.equal(result.status, "success");
    const data = result.data as RecommendRebalanceData;
    assert.match(data.planId, /^plan_/);
    assert.equal(next.lastPlanId, data.planId);
    assert.equal(next.lastPositionId, "77");
  });

  it("apply_plan with planId + signerMode returns submitted tx and updates session", async () => {
    const { result, session: next } = await executeIntent(
      intent("apply_plan", { planId: "plan_abc", signerMode: "wallet" }),
      ctx(),
    );
    assert.equal(result.status, "success");
    const data = result.data as ApplyPlanData;
    assert.equal(data.planId, "plan_abc");
    assert.equal(data.signerMode, "wallet");
    assert.match(data.txHash, /^0x[a-f0-9]+/);
    assert.equal(next.lastPlanId, "plan_abc");
    assert.equal(next.signerMode, "wallet");
  });

  it("list_positions does not require any session state", async () => {
    const { result } = await executeIntent(intent("list_positions"), ctx());
    assert.equal(result.status, "success");
    assert.equal(result.tool, "listWalletPositions");
  });
});

describe("executeIntent — fallback to session state", () => {
  it("inspect_position falls back to session.lastPositionId", async () => {
    const { result, session: next } = await executeIntent(
      intent("inspect_position"),
      ctx(session({ lastPositionId: "pos_99" })),
    );
    assert.equal(result.status, "success");
    const data = result.data as InspectPositionData;
    assert.equal(data.positionId, "pos_99");
    assert.equal(next.lastPositionId, "pos_99");
  });

  it("show_diff falls back to session.lastPlanId", async () => {
    const { result, session: next } = await executeIntent(
      intent("show_diff"),
      ctx(session({ lastPlanId: "plan_xyz" })),
    );
    assert.equal(result.status, "success");
    const data = result.data as { planId: string };
    assert.equal(data.planId, "plan_xyz");
    assert.equal(next.lastPlanId, "plan_xyz");
  });

  it("simulate_plan falls back to session.lastPlanId", async () => {
    const { result } = await executeIntent(
      intent("simulate_plan"),
      ctx(session({ lastPlanId: "plan_xyz" })),
    );
    assert.equal(result.status, "success");
  });

  it("apply_plan with session plan but no signer asks for SIGNER_NOT_SPECIFIED", async () => {
    const { result } = await executeIntent(
      intent("apply_plan"),
      ctx(session({ lastPlanId: "plan_xyz" })),
    );
    assert.equal(result.status, "error");
    assert.equal(result.errorCode, "SIGNER_NOT_SPECIFIED");
  });
});

describe("executeIntent — error cases", () => {
  it("inspect_position with no id and no session → POSITION_NOT_FOUND", async () => {
    const { result, session: next } = await executeIntent(intent("inspect_position"), ctx());
    assert.equal(result.status, "error");
    assert.equal(result.errorCode, "POSITION_NOT_FOUND");
    assert.equal(next.lastPositionId, null);
    assert.equal(next.lastIntent, null, "no session writes on failure");
  });

  it("show_diff without plan returns PLAN_NOT_FOUND", async () => {
    const { result } = await executeIntent(intent("show_diff"), ctx());
    assert.equal(result.status, "error");
    assert.equal(result.errorCode, "PLAN_NOT_FOUND");
  });

  it("apply_plan without plan returns PLAN_NOT_FOUND", async () => {
    const { result } = await executeIntent(
      intent("apply_plan", { signerMode: "wallet" }),
      ctx(),
    );
    assert.equal(result.status, "error");
    assert.equal(result.errorCode, "PLAN_NOT_FOUND");
  });

  it("show_balance without a connected wallet returns WALLET_NOT_CONNECTED", async () => {
    const { result } = await executeIntent(intent("show_balance"), ctx());
    assert.equal(result.status, "error");
    assert.equal(result.errorCode, "WALLET_NOT_CONNECTED");
  });

  it("returns TOOL_NOT_MAPPED if the registry is empty", async () => {
    const { result } = await executeIntent(intent("list_positions"), {
      session: emptySession,
      tools: [],
    });
    assert.equal(result.status, "error");
    assert.equal(result.errorCode, "TOOL_NOT_MAPPED");
  });

  it("returns TOOL_EXECUTION_FAILED when a tool throws", async () => {
    const exploding: ToolDefinition = {
      name: "listWalletPositions",
      intents: ["list_positions"],
      execute() {
        throw new Error("boom");
      },
    };
    const { result, session: next } = await executeIntent(intent("list_positions"), {
      session: emptySession,
      tools: [exploding],
    });
    assert.equal(result.status, "error");
    assert.equal(result.errorCode, "TOOL_EXECUTION_FAILED");
    assert.match(result.message, /boom/);
    assert.equal(next.lastIntent, null);
  });
});

describe("executeIntent — session immutability", () => {
  it("returns a new session object on success rather than mutating the input", async () => {
    const before = session({ lastPositionId: "old" });
    const { session: next } = await executeIntent(
      intent("inspect_position", { positionId: "42" }),
      ctx(before),
    );
    assert.equal(before.lastPositionId, "old", "input snapshot must not be mutated");
    assert.equal(next.lastPositionId, "42");
    assert.notEqual(before, next);
  });
});
