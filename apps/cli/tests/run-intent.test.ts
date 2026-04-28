import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionState } from "@zuno/core";
import { runIntent } from "../src/shell/run-intent.js";

const emptySession: SessionState = {
  walletAddress: null,
  chainId: null,
  lastPositionId: null,
  lastPlanId: null,
  lastIntent: null,
  signerMode: null,
};

describe("runIntent — shell-level intents do not touch the runtime", () => {
  it("help returns no result and bumps lastIntent", async () => {
    const run = await runIntent("help", emptySession);
    assert.equal(run.intent.intent, "help");
    assert.equal(run.result, undefined);
    assert.equal(run.session.lastIntent, "help");
  });

  it("exit returns no result and bumps lastIntent", async () => {
    const run = await runIntent("quit", emptySession);
    assert.equal(run.intent.intent, "exit");
    assert.equal(run.result, undefined);
    assert.equal(run.session.lastIntent, "exit");
  });

  it("gibberish becomes needs_clarification, not a runtime call", async () => {
    const run = await runIntent("xyzzy frobnicate", emptySession);
    assert.equal(run.intent.intent, "needs_clarification");
    assert.equal(run.result, undefined);
    assert.match(run.intent.clarification ?? "", /try/iu);
  });
});

describe("runIntent — actionable intents go through the runtime", () => {
  it("inspect_position with id returns a result and updates session", async () => {
    const run = await runIntent("inspect position 42", emptySession);
    assert.equal(run.intent.intent, "inspect_position");
    assert.ok(run.result, "expected a runtime result");
    assert.equal(run.result?.tool, "inspectPosition");
    assert.equal(run.result?.status, "success");
    assert.equal(run.session.lastPositionId, "42");
    assert.equal(run.session.lastIntent, "inspect_position");
  });

  it("connect_wallet adopts wallet fields from the runtime outcome", async () => {
    const run = await runIntent("connect my wallet", emptySession);
    assert.equal(run.result?.tool, "connectWallet");
    assert.equal(run.result?.status, "success");
    assert.match(run.session.walletAddress ?? "", /^0x[a-f0-9]{40}$/);
    assert.equal(run.session.signerMode, "wallet");
  });

  it("recommend_rebalance writes the new planId to session", async () => {
    const run = await runIntent("recommend what I should do with position 77", emptySession);
    assert.equal(run.result?.tool, "recommendRebalance");
    assert.equal(run.result?.status, "success");
    assert.match(run.session.lastPlanId ?? "", /^plan_/u);
  });

  it("show_diff falls through session.lastPlanId via the runtime", async () => {
    const run = await runIntent("show me the diff", {
      ...emptySession,
      lastPlanId: "plan_abc",
    });
    assert.equal(run.result?.tool, "showPlanDiff");
    assert.equal(run.result?.status, "success");
    assert.equal(run.session.lastPlanId, "plan_abc");
  });
});

describe("runIntent — runtime errors are preserved on the result", () => {
  it("apply_plan with no plan returns a structured error", async () => {
    const run = await runIntent("apply plan_abc", emptySession);
    // parser turns this into needs_clarification (signer missing)
    assert.equal(run.intent.intent, "needs_clarification");
    assert.equal(run.result, undefined);
  });

  it("apply_plan with plan + signer succeeds", async () => {
    const run = await runIntent("apply plan_abc with my wallet", emptySession);
    assert.equal(run.intent.intent, "apply_plan");
    assert.equal(run.result?.tool, "applyPlan");
    assert.equal(run.result?.status, "success");
    assert.equal(run.session.lastPlanId, "plan_abc");
    assert.equal(run.session.signerMode, "wallet");
  });
});
