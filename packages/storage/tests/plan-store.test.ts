import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Address, Plan, PositionAlert } from "@zuno/core";
import { createMemoryAlertStore, createMemoryPlanStore } from "../src/index.js";

describe("memory plan store", () => {
  it("saves, loads, and tracks the latest plan", async () => {
    const plan = { id: "plan_test" } as Plan;
    const store = createMemoryPlanStore();
    assert.equal(await store.latest(), null);
    await store.save(plan);
    assert.equal((await store.get(plan.id))?.id, plan.id);
    assert.equal((await store.latest())?.id, plan.id);
  });
});

describe("memory alert store", () => {
  it("saves, lists, finds, and acknowledges alerts", async () => {
    const alert: PositionAlert = {
      id: "alert_test",
      walletAddress: "0xabc1230000000000000000000000000000000def" as Address,
      chainId: 42161,
      positionId: "pos_4f2a3b",
      severity: "critical",
      kind: "out_of_range",
      message: "position out of range",
      reason: "out of range",
      createdAt: 1,
    };
    const store = createMemoryAlertStore();
    await store.save(alert);
    assert.equal((await store.list())[0]?.id, alert.id);
    assert.equal((await store.latestForPosition(alert.positionId))?.id, alert.id);
    assert.ok((await store.acknowledge(alert.id))?.acknowledgedAt);
  });
});
