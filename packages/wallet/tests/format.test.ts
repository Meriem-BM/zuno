import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chainNameFor, shortAddr } from "../src/index.js";

describe("wallet formatting", () => {
  it("shortens addresses for terminal status lines", () => {
    assert.equal(shortAddr("0x111111111111111111111111111111111111abcd"), "0x1111…abcd");
  });

  it("names supported chains", () => {
    assert.equal(chainNameFor(1), "Mainnet");
    assert.equal(chainNameFor(42161), "Arbitrum");
    assert.equal(chainNameFor(999), "Chain 999");
  });
});
