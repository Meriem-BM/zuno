import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Address, Token } from "@zuno/core";
import { minOutputFor, quoteSwap, type SwapReadClient } from "../../src/uniswap/quoter/index.js";

const weth: Token = {
  address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1" as Address,
  symbol: "WETH",
  decimals: 18,
};
const usdc: Token = {
  address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831" as Address,
  symbol: "USDC",
  decimals: 6,
};

interface Args {
  args: readonly [{ fee: number }];
}

const fakeClient = (perFee: Record<number, bigint>): SwapReadClient => ({
  async readContract({ args }) {
    const [params] = args as Args["args"];
    const out = perFee[params.fee] ?? 0n;
    return [out, 0n, 0, 100_000n];
  },
});

describe("swap quoting", () => {
  it("picks the fee tier with the highest output", async () => {
    const client = fakeClient({
      500: 1_900_000_000n,
      3000: 2_100_000_000n,
      10_000: 1_500_000_000n,
    });
    const quote = await quoteSwap(
      {
        tokenIn: weth,
        tokenOut: usdc,
        amountIn: "1",
        chainId: 42161,
      },
      { client },
    );
    assert.equal(quote.feeTier, 3000);
    assert.equal(quote.amountOut, "2100");
    assert.equal(quote.tokenIn.symbol, "WETH");
    assert.equal(quote.tokenOut.symbol, "USDC");
  });

  it("throws when no pool returns a non-zero quote", async () => {
    const client = fakeClient({ 500: 0n, 3000: 0n, 10_000: 0n });
    await assert.rejects(
      () => quoteSwap({ tokenIn: weth, tokenOut: usdc, amountIn: "1", chainId: 42161 }, { client }),
      /No Uniswap V3 pool/u,
    );
  });

  it("minOutputFor applies basis-point slippage", () => {
    const quote = {
      chainId: 42161,
      tokenIn: weth,
      tokenOut: usdc,
      amountIn: "1",
      amountInWei: "1000000000000000000",
      amountOut: "2100",
      amountOutWei: "2100000000",
      feeTier: 3000,
      price: 2100,
      source: "uniswap_v3",
    } as const;
    assert.equal(minOutputFor(quote, 0), 2_100_000_000n);
    assert.equal(minOutputFor(quote, 50), (2_100_000_000n * 9_950n) / 10_000n);
    assert.equal(minOutputFor(quote, 100), (2_100_000_000n * 9_900n) / 10_000n);
  });
});
