import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chainConfig, resolveNetwork, viemChainFor } from "@zuno/chain/config";

describe("@zuno/chain/config", () => {
  it("exposes the testnet v4 deployments", () => {
    assert.equal(chainConfig(11155111).name, "Sepolia");
    assert.equal(chainConfig(84532).name, "Base Sepolia");
    assert.equal(chainConfig(421614).name, "Arbitrum Sepolia");
    assert.equal(chainConfig(1301).name, "Unichain Sepolia");
  });

  it("resolves network names and aliases, including the spolia typo", () => {
    assert.equal(resolveNetwork("switch to spolia")?.chainId, 11155111);
    assert.equal(resolveNetwork("switch to base sepolia")?.chainId, 84532);
    assert.equal(resolveNetwork("switch to arbitrum sepolia")?.chainId, 421614);
    assert.equal(resolveNetwork("switch to unichain sepolia")?.chainId, 1301);
  });

  it("maps testnets to viem chain objects", () => {
    assert.equal(viemChainFor(11155111).id, 11155111);
    assert.equal(viemChainFor(84532).id, 84532);
    assert.equal(viemChainFor(421614).id, 421614);
    assert.equal(viemChainFor(1301).id, 1301);
  });
});
