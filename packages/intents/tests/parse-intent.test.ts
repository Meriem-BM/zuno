import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionState } from "@zuno/core";
import { createModelFallback } from "../src/model-fallback.js";
import { parseIntent, parseIntentDeterministic } from "../src/parse-intent.js";

const emptySession: SessionState = {
  walletAddress: null,
  chainId: null,
  lastPositionId: null,
  lastPlanId: null,
  lastIntent: null,
  signerMode: null,
};

const session = (patch: Partial<SessionState>): SessionState => ({
  ...emptySession,
  ...patch,
});

describe("direct intents", () => {
  it("parses 'show my positions' as list_positions", async () => {
    const i = await parseIntent("show my positions");
    assert.equal(i.intent, "list_positions");
    assert.ok(i.confidence > 0.5);
  });

  it("parses 'inspect position 42' with positionId", async () => {
    const i = await parseIntent("inspect position 42");
    assert.equal(i.intent, "inspect_position");
    assert.equal(i.positionId, "42");
    assert.ok(i.confidence > 0.8);
  });

  it("parses 'recommend what I should do with position 42'", async () => {
    const i = await parseIntent("recommend what I should do with position 42");
    assert.equal(i.intent, "recommend_rebalance");
    assert.equal(i.positionId, "42");
  });

  it("parses 'connect my wallet'", async () => {
    const i = await parseIntent("connect my wallet");
    assert.equal(i.intent, "connect_wallet");
  });

  it("parses 'are the agents online' as agent_status", async () => {
    const i = await parseIntent("are the agents online");
    assert.equal(i.intent, "agent_status");
  });

  it("parses 'which positions are out of range'", async () => {
    const i = await parseIntent("which positions are out of range");
    assert.equal(i.intent, "list_out_of_range_positions");
  });

  it("parses bare 'help' and 'quit'", async () => {
    assert.equal((await parseIntent("help")).intent, "help");
    assert.equal((await parseIntent("quit")).intent, "exit");
  });
});

describe("entity extraction", () => {
  it("extracts a numeric position id", () => {
    const i = parseIntentDeterministic("inspect position 42");
    assert.equal(i.positionId, "42");
  });

  it("extracts a prefixed position id", () => {
    const i = parseIntentDeterministic("look at pos_4f2a3b");
    assert.equal(i.positionId, "pos_4f2a3b");
  });

  it("extracts a plan id from 'show me the diff for plan_dd4f9e'", () => {
    const i = parseIntentDeterministic("show me the diff for plan_dd4f9e");
    assert.equal(i.planId, "plan_dd4f9e");
  });

  it("lowercases extracted wallet addresses", () => {
    const i = parseIntentDeterministic(
      "send 10 usdc to 0xAbCdEf0123456789aBcDeF0123456789aBcDeF01",
    );
    assert.equal(i.walletAddress, "0xabcdef0123456789abcdef0123456789abcdef01");
  });

  it("extracts amount with a known token", () => {
    const i = parseIntentDeterministic("send 10 usdc to 0x0000000000000000000000000000000000000000");
    assert.equal(i.amount, "10");
    assert.equal(i.tokenSymbol, "usdc");
  });

  it("ignores amount when token is unknown", () => {
    const i = parseIntentDeterministic("send 10 zzcoin");
    assert.equal(i.amount, undefined);
    assert.equal(i.tokenSymbol, undefined);
  });

  it("extracts wallet vs enclave signer mode", () => {
    assert.equal(
      parseIntentDeterministic("apply plan_abc with my wallet").signerMode,
      "wallet",
    );
    assert.equal(
      parseIntentDeterministic("apply plan_abc with the enclave").signerMode,
      "enclave",
    );
  });
});

describe("session-aware references", () => {
  it("resolves 'this position' against lastPositionId", async () => {
    const i = await parseIntent("recommend what I should do with this position", {
      session: session({ lastPositionId: "pos_42" }),
    });
    assert.equal(i.intent, "recommend_rebalance");
    assert.equal(i.positionId, "pos_42");
  });

  it("resolves bare 'inspect' against session position", async () => {
    const i = await parseIntent("inspect", {
      session: session({ lastPositionId: "pos_99" }),
    });
    assert.equal(i.intent, "inspect_position");
    assert.equal(i.positionId, "pos_99");
  });

  it("resolves 'show me the diff' against session plan", async () => {
    const i = await parseIntent("show me the diff", {
      session: session({ lastPlanId: "plan_123" }),
    });
    assert.equal(i.intent, "show_diff");
    assert.equal(i.planId, "plan_123");
  });

  it("resolves 'apply it with wallet' against session plan", async () => {
    const i = await parseIntent("apply it with wallet", {
      session: session({ lastPlanId: "plan_123" }),
    });
    assert.equal(i.intent, "apply_plan");
    assert.equal(i.planId, "plan_123");
    assert.equal(i.signerMode, "wallet");
  });

  it("does not auto-fill signerMode from session", async () => {
    const i = await parseIntent("apply it", {
      session: session({ lastPlanId: "plan_123", signerMode: "wallet" }),
    });
    assert.equal(i.intent, "needs_clarification");
    assert.match(i.clarification ?? "", /wallet|enclave/u);
  });
});

describe("clarification", () => {
  it("asks which position when 'inspect' has no session reference", async () => {
    const i = await parseIntent("inspect");
    assert.equal(i.intent, "needs_clarification");
    assert.match(i.clarification ?? "", /position/iu);
    assert.ok(i.confidence < 0.5);
  });

  it("asks which plan when 'show me the diff' has no session", async () => {
    const i = await parseIntent("show me the diff");
    assert.equal(i.intent, "needs_clarification");
    assert.match(i.clarification ?? "", /plan/iu);
  });

  it("asks for signer when 'apply it' has a plan but no signer", async () => {
    const i = await parseIntent("apply it", {
      session: session({ lastPlanId: "plan_abc" }),
    });
    assert.equal(i.intent, "needs_clarification");
    assert.match(i.clarification ?? "", /wallet|enclave/iu);
  });
});

describe("confidence", () => {
  it("assigns high confidence to clear input", async () => {
    const i = await parseIntent("inspect position 42");
    assert.ok(i.confidence >= 0.8, `expected >=0.8, got ${i.confidence}`);
  });

  it("never claims certainty (capped < 1.0)", async () => {
    const i = await parseIntent("inspect position 42");
    assert.ok(i.confidence < 1.0);
  });

  it("drops confidence below 0.5 on clarification", async () => {
    const i = await parseIntent("inspect");
    assert.ok(i.confidence < 0.5);
  });
});

describe("model fallback", () => {
  it("does not invoke the fallback for high-confidence parses", async () => {
    let called = false;
    await parseIntent("inspect position 42", {
      fallback: {
        async parse() {
          called = true;
          return null;
        },
      },
    });
    assert.equal(called, false);
  });

  it("invokes the fallback for unknown input", async () => {
    let called = false;
    await parseIntent("xyzzy frobnicate", {
      fallback: {
        async parse() {
          called = true;
          return null;
        },
      },
    });
    assert.equal(called, true);
  });

  it("returns the fallback's intent when it succeeds", async () => {
    const i = await parseIntent("xyzzy frobnicate", {
      fallback: {
        async parse() {
          return {
            intent: "list_positions",
            rawInput: "xyzzy frobnicate",
            confidence: 0.85,
          };
        },
      },
    });
    assert.equal(i.intent, "list_positions");
    assert.equal(i.confidence, 0.85);
  });

  it("falls back to the friendly hint when fallback returns null", async () => {
    const i = await parseIntent("xyzzy frobnicate", {
      fallback: { async parse() { return null; } },
    });
    assert.equal(i.intent, "needs_clarification");
    assert.match(i.clarification ?? "", /try/iu);
  });

  it("does not invoke the fallback when result is needs_clarification", async () => {
    let called = false;
    await parseIntent("inspect", {
      fallback: {
        async parse() {
          called = true;
          return null;
        },
      },
    });
    assert.equal(called, false);
  });
});

describe("createModelFallback", () => {
  it("returns a no-op fallback when no API key is configured", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const fallback = createModelFallback({ apiKey: undefined });
      const result = await fallback.parse("anything", undefined);
      assert.equal(result, null);
    } finally {
      if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    }
  });
});

describe("edge cases", () => {
  it("deterministic parser returns bare unknown for empty input", () => {
    const i = parseIntentDeterministic("");
    assert.equal(i.intent, "unknown");
  });

  it("returns needs_clarification with a hint for unrecognised input", async () => {
    const i = await parseIntent("xyzzy frobnicate widget");
    assert.equal(i.intent, "needs_clarification");
    assert.match(i.clarification ?? "", /try/iu);
  });

  it("normalises filler-word noise without hurting matches", async () => {
    const i = await parseIntent("Please show me my positions");
    assert.equal(i.intent, "list_positions");
  });

  it("strips trailing punctuation", async () => {
    const i = await parseIntent("are the agents online?");
    assert.equal(i.intent, "agent_status");
  });
});

describe("conversational fallbacks", () => {
  it("treats greetings as help", async () => {
    for (const greeting of ["hi", "hello", "hey", "yo", "good morning"]) {
      const i = await parseIntent(greeting);
      assert.equal(i.intent, "help", `${greeting} should map to help`);
    }
  });

  it("matches 'what's my wallet' as show_balance", async () => {
    const i = await parseIntent("what's my wallet");
    assert.equal(i.intent, "show_balance");
  });

  it("matches 'what do i have' as show_balance", async () => {
    const i = await parseIntent("what do i have");
    assert.equal(i.intent, "show_balance");
  });
});
