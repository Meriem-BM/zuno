import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Address, Token } from "@zuno/core";
import {
  buildApproveTransaction,
  checkApprovalRequirement,
  checkPermit2ApprovalRequirement,
  fetchBalances,
  MAX_UINT256,
  lookupToken,
  readAllowance,
  readPermit2Allowance,
  type TokenReadClient,
} from "../../src/tokens/index.js";

const owner = "0x000000000000000000000000000000000000aaaa" as Address;
const spender = "0x000000000000000000000000000000000000bbbb" as Address;
const usdc: Token = {
  address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831" as Address,
  symbol: "USDC",
  decimals: 6,
};

const balanceClient: TokenReadClient = {
  async getBalance() {
    return 1_500_000_000_000_000_000n;
  },
  async multicall({ contracts }) {
    return contracts.map(
      (c) =>
        ({
          status: "success",
          result: c.address.toLowerCase() === usdc.address.toLowerCase() ? 1_234_560_000n : 0n,
        }) as { status: "success"; result: unknown },
    );
  },
  async readContract() {
    return 0n;
  },
};

const allowanceClient = (allowanceWei: bigint): TokenReadClient => ({
  async getBalance() {
    return 0n;
  },
  async multicall() {
    return [];
  },
  async readContract() {
    return allowanceWei;
  },
});

const permit2AllowanceClient = (
  amount: bigint,
  expiration = Math.floor(Date.now() / 1000) + 3600,
): TokenReadClient => ({
  async getBalance() {
    return 0n;
  },
  async multicall() {
    return [];
  },
  async readContract() {
    return [amount, expiration, 7] as const;
  },
});

describe("@zuno/chain/tokens - balances", () => {
  it("returns native + dedup'd ERC20 list", async () => {
    const snap = await fetchBalances(owner, 42161, {
      client: balanceClient,
      extraTokens: [usdc],
    });
    assert.equal(snap.chainName, "Arbitrum");
    assert.equal(snap.native.symbol, "ETH");
    assert.equal(snap.native.amount, "1.5");
    const usdcEntry = snap.tokens.find((t) => t.token.symbol === "USDC");
    assert.ok(usdcEntry);
    assert.equal(usdcEntry.amount, "1234.56");
  });

  it("dedupes when extraTokens overlap the whitelist", async () => {
    const snap = await fetchBalances(owner, 42161, {
      client: balanceClient,
      extraTokens: [usdc],
    });
    const count = snap.tokens.filter(
      (t) => t.token.address.toLowerCase() === usdc.address.toLowerCase(),
    ).length;
    assert.equal(count, 1);
  });

  it("includes the testnet whitelist tokens", () => {
    assert.equal(
      lookupToken("WETH", 11155111)?.address.toLowerCase(),
      "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
    );
    assert.equal(
      lookupToken("USDC", 1301)?.address.toLowerCase(),
      "0x31d0220469e10c4e71834a79b1f276d740d3768f",
    );
  });
});

describe("@zuno/chain/tokens - allowances + approve", () => {
  it("reads and formats allowance", async () => {
    const reading = await readAllowance(
      { token: usdc, owner, spender, chainId: 42161 },
      { client: allowanceClient(1_500_000n) },
    );
    assert.equal(reading.allowance, "1.5");
    assert.equal(reading.sufficient, undefined);
  });

  it("flags sufficient when required amount provided", async () => {
    const reading = await readAllowance(
      { token: usdc, owner, spender, chainId: 42161 },
      { client: allowanceClient(2_000_000n), requiredWei: 1_000_000n },
    );
    assert.equal(reading.sufficient, true);
  });

  it("checkApprovalRequirement detects shortfall", async () => {
    const req = await checkApprovalRequirement(
      { token: usdc, owner, spender, chainId: 42161 },
      5_000_000n,
      { client: allowanceClient(1_000_000n) },
    );
    assert.equal(req.needsApproval, true);
  });

  it("reads Permit2 allowance for a spender", async () => {
    const reading = await readPermit2Allowance(
      { token: usdc, owner, spender, chainId: 42161 },
      { client: permit2AllowanceClient(2_000_000n), requiredWei: 1_000_000n },
    );
    assert.equal(reading.allowanceWei, "2000000");
    assert.equal(reading.sufficient, true);
    assert.equal(reading.nonce, 7);
  });

  it("detects missing or expired Permit2 spender approval", async () => {
    const missing = await checkPermit2ApprovalRequirement(
      { token: usdc, owner, spender, chainId: 42161 },
      5_000_000n,
      { client: permit2AllowanceClient(1_000_000n) },
    );
    assert.equal(missing.needsApproval, true);

    const expired = await checkPermit2ApprovalRequirement(
      { token: usdc, owner, spender, chainId: 42161 },
      1_000_000n,
      { client: permit2AllowanceClient(2_000_000n, 1) },
    );
    assert.equal(expired.needsApproval, true);
    assert.equal(expired.expired, true);
  });

  it("buildApproveTransaction encodes the approve selector and amount", () => {
    const tx = buildApproveTransaction(usdc, spender, 5_000_000n, 42161);
    assert.equal(tx.to, usdc.address);
    assert.equal(tx.value, "0");
    assert.ok(tx.data.startsWith("0x095ea7b3"));
    assert.match(tx.description, /approve 5 USDC/u);
  });

  it("renders 'unlimited' for MAX_UINT256 approvals", () => {
    const tx = buildApproveTransaction(usdc, spender, MAX_UINT256, 42161);
    assert.match(tx.description, /unlimited USDC/u);
  });
});
