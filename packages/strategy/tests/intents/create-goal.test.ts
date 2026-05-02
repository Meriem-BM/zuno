import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractCreateGoal,
  hasCreateCapital,
  parseCreateCapitalAnswer,
} from "../../src/intents/parser/create-goal.js";
import { parseIntentDeterministic } from "../../src/intents/parser/parse-intent.js";
import { tryResumePending } from "../../src/intents/parser/clarification.js";

describe("extractCreateGoal", () => {
  it("extracts amount + token in 'amount token' order", () => {
    const goal = extractCreateGoal("LP 2.5 ETH passively");
    assert.deepEqual(goal.capital, { amount: "2.5", tokenSymbol: "eth" });
    assert.equal(goal.riskProfile, "conservative");
  });

  it("extracts amount + token in 'token amount' order", () => {
    const goal = extractCreateGoal("provide liquidity ETH 0.05");
    assert.deepEqual(goal.capital, { tokenSymbol: "eth", amount: "0.05" });
  });

  it("captures token without amount as half-capital", () => {
    const goal = extractCreateGoal("I want to LP some USDC");
    assert.equal(goal.capital?.tokenSymbol, "usdc");
    assert.equal(goal.capital?.amount, "");
  });

  it("maps risk aliases", () => {
    assert.equal(extractCreateGoal("LP 1 ETH yolo").riskProfile, "aggressive");
    assert.equal(extractCreateGoal("provide ETH passively").riskProfile, "conservative");
    assert.equal(extractCreateGoal("balanced 1 ETH").riskProfile, "balanced");
  });

  it("captures pinned pair", () => {
    const goal = extractCreateGoal("create ETH/USDC position");
    assert.deepEqual(goal.pinnedPair, { token0Symbol: "eth", token1Symbol: "usdc" });
  });

  it("captures pinned fee tier from bps", () => {
    assert.equal(extractCreateGoal("ETH/USDC 5bps with 1 ETH").pinnedFeeTier, 5);
    assert.equal(extractCreateGoal("ETH/USDC 30bps").pinnedFeeTier, 30);
  });

  it("captures pinned fee tier from %", () => {
    assert.equal(extractCreateGoal("ETH/USDC 0.05%").pinnedFeeTier, 500);
    assert.equal(extractCreateGoal("0.3% ETH/USDC pool").pinnedFeeTier, 3000);
  });

  it("captures stay-in-token exposure", () => {
    const goal = extractCreateGoal("LP 1 ETH but stay long ETH");
    assert.equal(goal.exposurePreference, "stay-in-token");
  });

  it("returns empty object for unrelated input", () => {
    assert.deepEqual(extractCreateGoal("inspect my positions"), {});
  });
});

describe("parseCreateCapitalAnswer", () => {
  it("parses 'amount token'", () => {
    assert.deepEqual(parseCreateCapitalAnswer("0.05 ETH"), {
      amount: "0.05",
      tokenSymbol: "eth",
    });
  });
  it("parses 'token amount'", () => {
    assert.deepEqual(parseCreateCapitalAnswer("ETH 0.05"), {
      tokenSymbol: "eth",
      amount: "0.05",
    });
  });
  it("rejects bare numbers (must be paired with token)", () => {
    assert.equal(parseCreateCapitalAnswer("0.05"), null);
  });
});

describe("hasCreateCapital", () => {
  it("requires both fields", () => {
    assert.equal(hasCreateCapital({ capital: { tokenSymbol: "eth", amount: "1" } }), true);
    assert.equal(hasCreateCapital({ capital: { tokenSymbol: "eth", amount: "" } }), false);
    assert.equal(hasCreateCapital({ capital: { tokenSymbol: "", amount: "1" } }), false);
    assert.equal(hasCreateCapital({}), false);
    assert.equal(hasCreateCapital(undefined), false);
  });
});

describe("create_position deterministic parser", () => {
  it("parses a fully-specified intent in one shot", () => {
    const intent = parseIntentDeterministic("create ETH/USDC position with 1.5 ETH passively");
    assert.equal(intent.intent, "create_position");
    assert.equal(intent.createGoal?.capital?.tokenSymbol, "eth");
    assert.equal(intent.createGoal?.capital?.amount, "1.5");
    assert.equal(intent.createGoal?.riskProfile, "conservative");
    assert.deepEqual(intent.createGoal?.pinnedPair, {
      token0Symbol: "eth",
      token1Symbol: "usdc",
    });
  });

  it("triggers clarification when amount is missing", () => {
    const intent = parseIntentDeterministic("open a new position with ETH");
    assert.equal(intent.intent, "needs_clarification");
    assert.equal(intent.pendingIntent, "create_position");
    assert.equal(intent.pendingField, "createCapital");
    assert.match(intent.clarification ?? "", /how much.*ETH/iu);
  });

  it("triggers clarification when both fields missing", () => {
    const intent = parseIntentDeterministic("create a new position");
    assert.equal(intent.intent, "needs_clarification");
    assert.equal(intent.pendingField, "createCapital");
    assert.match(intent.clarification ?? "", /which token and how much/iu);
  });
});

describe("clarification resume - createCapital", () => {
  it("fills capital when answer is 'amount token'", () => {
    const resumed = tryResumePending(
      "0.05 ETH",
      {
        intent: "create_position",
        field: "createCapital",
        createGoal: { riskProfile: "conservative" },
      },
      undefined,
    );
    assert.ok(resumed);
    assert.equal(resumed.intent, "create_position");
    assert.equal(resumed.createGoal?.capital?.tokenSymbol, "eth");
    assert.equal(resumed.createGoal?.capital?.amount, "0.05");
    assert.equal(resumed.createGoal?.riskProfile, "conservative");
  });

  it("fills amount when token already pinned and answer is bare number", () => {
    const resumed = tryResumePending(
      "0.05",
      {
        intent: "create_position",
        field: "createCapital",
        createGoal: { capital: { tokenSymbol: "eth", amount: "" } },
      },
      undefined,
    );
    assert.ok(resumed);
    assert.equal(resumed.createGoal?.capital?.amount, "0.05");
    assert.equal(resumed.createGoal?.capital?.tokenSymbol, "eth");
  });

  it("returns null when answer doesn't fit", () => {
    const resumed = tryResumePending(
      "what is this",
      { intent: "create_position", field: "createCapital", createGoal: {} },
      undefined,
    );
    assert.equal(resumed, null);
  });
});
