import assert from "node:assert/strict";
import test, { describe, it } from "node:test";
import type { SessionState } from "@zuno/core";
import { createModelFallback } from "../../src/intents/model/fallback.js";
import { parseIntent, parseIntentDeterministic } from "../../src/intents/parser/parse-intent.js";

const baseSession: SessionState = {
  userWalletAddress: null,
  agentWalletAddress: null,
  chainId: null,
  lastPositionId: null,
  lastPlanId: null,
  lastActionId: null,
  lastIntent: null,
  approvalState: "idle",
  executionState: "idle",
};

function session(patch: Partial<SessionState>): SessionState {
  return { ...baseSession, ...patch };
}

describe("agent wallet intents", () => {
  const cases = [
    ["create my zuno wallet", "create_agent_wallet"],
    ["setup agent wallet", "create_agent_wallet"],
    ["show my zuno wallet", "show_agent_wallet"],
    ["what's my agent wallet", "show_agent_wallet"],
    ["what's my zuno wallet balance", "show_agent_wallet_balance"],
    ["fund my zuno wallet", "fund_agent_wallet"],
    ["deposit into agent wallet", "fund_agent_wallet"],
  ] as const;

  for (const [input, expected] of cases) {
    it(`parses '${input}' as ${expected}`, async () => {
      const intent = await parseIntent(input);
      assert.equal(intent.intent, expected);
      assert.ok(intent.confidence >= 0.5);
    });
  }
});

describe("LP workflow intents", () => {
  it("lists positions in the Zuno wallet", async () => {
    assert.equal((await parseIntent("inspect my positions")).intent, "list_positions");
  });

  it("resolves position references from session", async () => {
    const intent = await parseIntent("recommend what I should do with this position", {
      session: session({ lastPositionId: "42" }),
    });
    assert.equal(intent.intent, "recommend_rebalance");
    assert.equal(intent.positionId, "42");
  });

  it("resolves plan references through diff, simulation, approval, and apply", async () => {
    const s = session({ lastPlanId: "plan_abc" });
    assert.equal((await parseIntent("show me the diff", { session: s })).planId, "plan_abc");
    assert.equal((await parseIntent("simulate it", { session: s })).intent, "simulate_plan");
    assert.equal((await parseIntent("approve it", { session: s })).intent, "approve_plan");
    assert.equal((await parseIntent("apply it", { session: s })).intent, "apply_plan");
  });

  it("treats the latest prepared action as the thing to approve or apply", async () => {
    const s = session({ lastActionId: "swap_abc" });
    assert.equal((await parseIntent("approve it", { session: s })).planId, "swap_abc");
    assert.equal((await parseIntent("apply it", { session: s })).planId, "swap_abc");
  });

  it("asks for a plan before approval or execution", async () => {
    const approve = await parseIntent("approve it");
    assert.equal(approve.intent, "needs_clarification");
    assert.equal(approve.pendingIntent, "approve_plan");

    const apply = await parseIntent("apply it");
    assert.equal(apply.intent, "needs_clarification");
    assert.equal(apply.pendingIntent, "apply_plan");
  });
});

describe("boundaries", () => {
  it("does not treat bare wallet addresses as the primary product path", async () => {
    const intent = await parseIntent("0xabcdef0123456789abcdef0123456789abcdef01");
    assert.equal(intent.intent, "needs_clarification");
  });

  it("keeps standalone swaps outside the LP workflow", async () => {
    const intent = await parseIntent("swap eth to usdc");
    assert.equal(intent.intent, "swap_tokens");
  });

  it("keeps greetings useful", async () => {
    const intent = await parseIntent("hi");
    assert.equal(intent.intent, "help");
  });

  it("recognizes testnet network names and the spolia typo", async () => {
    assert.equal((await parseIntent("switch to spolia")).chainName, "sepolia");
    assert.equal((await parseIntent("switch to base sepolia")).chainName, "base sepolia");
    assert.equal((await parseIntent("switch to arbitrum sepolia")).chainName, "arbitrum sepolia");
    assert.equal((await parseIntent("switch to unichain sepolia")).chainName, "unichain sepolia");
  });
});

describe("typos and fallback", () => {
  it("corrects common command typos", async () => {
    const intent = await parseIntent("agent satust");
    assert.equal(intent.intent, "agent_status");
    assert.ok(intent.corrections?.length);
  });

  it("invokes model fallback for unknown input", async () => {
    let called = false;
    const intent = await parseIntent("pull up my concentrated liquidity overview", {
      fallback: {
        async parse(input) {
          called = true;
          return {
            intent: "inspect_all_positions",
            rawInput: input,
            confidence: 0.82,
          };
        },
      },
    });
    assert.equal(called, true);
    assert.equal(intent.intent, "inspect_all_positions");
  });
});

describe("createModelFallback", () => {
  it("returns a no-op fallback when no provider key is configured", async () => {
    const fallback = createModelFallback({
      apiKey: "",
      groqApiKey: "",
    });
    assert.equal(await fallback.parse("whatever"), null);
  });

  it("deterministic parser keeps plan ids", () => {
    const intent = parseIntentDeterministic("approve plan_123");
    assert.equal(intent.intent, "approve_plan");
    assert.equal(intent.planId, "plan_123");
  });
});

test("clarification follow-up resumes pending plan approval", async () => {
  const intent = await parseIntent("plan_123", {
    pending: { intent: "approve_plan", field: "planId" },
  });
  assert.equal(intent.intent, "approve_plan");
  assert.equal(intent.planId, "plan_123");
});
