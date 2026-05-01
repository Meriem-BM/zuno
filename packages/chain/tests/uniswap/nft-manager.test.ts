import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chainConfig } from "@zuno/chain/config";
import type { Address, Position, Token } from "@zuno/core";
import {
  buildBurn,
  buildCollect,
  buildDecreaseLiquidity,
  buildIncreaseLiquidity,
  buildMint,
  buildRebalanceCalldata,
  nfpmFor,
} from "../../src/uniswap/nft-manager/index.js";

const recipient = "0x000000000000000000000000000000000000aaaa" as Address;
const token0: Token = {
  address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1" as Address,
  symbol: "WETH",
  decimals: 18,
};
const token1: Token = {
  address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831" as Address,
  symbol: "USDC",
  decimals: 6,
};

const position: Position = {
  id: "42",
  owner: recipient,
  pool: {
    address: "0x0000000000000000000000000000000000000000" as Address,
    chainId: 42161,
    token0,
    token1,
    feeTier: 500,
    tickSpacing: 10,
    currentTick: -198_330,
    sqrtPriceX96: "0",
    liquidity: "0",
    price: 1,
  },
  tickLower: -199_400,
  tickUpper: -198_400,
  liquidity: "584029120348712",
  amount0: "0",
  amount1: "0",
  feesOwed0: "0",
  feesOwed1: "0",
};

describe("liquidity calldata", () => {
  it("nfpmFor returns the Arbitrum NFT manager", () => {
    assert.equal(nfpmFor(42161), "0xc36442b4a4522e871399cd717abdd847ab11fe88");
  });

  it("chain config uses the official Base NFT position manager", () => {
    assert.equal(nfpmFor(8453), "0x03a520b32c04bf3beef7beb72e919cf822ed34f1");
    assert.equal(
      chainConfig(8453).nonfungiblePositionManager,
      "0x03a520b32c04bf3beef7beb72e919cf822ed34f1",
    );
  });

  it("buildMint encodes the mint selector and target", () => {
    const tx = buildMint({
      token0,
      token1,
      fee: 500,
      tickLower: -200_000,
      tickUpper: -190_000,
      amount0Desired: "100000000000000000",
      amount1Desired: "200000000",
      amount0Min: "0",
      amount1Min: "0",
      recipient,
      deadline: 1_900_000_000,
      chainId: 42161,
    });
    assert.equal(tx.to, nfpmFor(42161));
    assert.equal(tx.value, "0");
    // mint(MintParams) selector
    assert.ok(tx.data.startsWith("0x88316456"), "expected mint selector 0x88316456");
    assert.match(tx.description, /mint WETH\/USDC 0\.05%/u);
  });

  it("buildIncreaseLiquidity encodes the right selector", () => {
    const tx = buildIncreaseLiquidity(
      {
        tokenId: 42n,
        amount0Desired: "50000000000000000",
        amount1Desired: "100000000",
        amount0Min: "0",
        amount1Min: "0",
        deadline: 1_900_000_000,
        chainId: 42161,
      },
      token0,
      token1,
    );
    assert.ok(tx.data.startsWith("0x219f5d17"), "expected increaseLiquidity selector 0x219f5d17");
  });

  it("buildDecreaseLiquidity encodes the right selector", () => {
    const tx = buildDecreaseLiquidity({
      tokenId: 42n,
      liquidity: 1_000_000n,
      amount0Min: "0",
      amount1Min: "0",
      deadline: 1_900_000_000,
      chainId: 42161,
    });
    assert.ok(tx.data.startsWith("0x0c49ccbe"), "expected decreaseLiquidity selector 0x0c49ccbe");
  });

  it("buildCollect encodes the collect selector", () => {
    const tx = buildCollect({
      tokenId: 42n,
      recipient,
      amount0Max: "",
      amount1Max: "",
      chainId: 42161,
    });
    assert.ok(tx.data.startsWith("0xfc6f7865"), "expected collect selector 0xfc6f7865");
  });

  it("buildBurn encodes the burn selector", () => {
    const tx = buildBurn({ tokenId: 42n, chainId: 42161 });
    assert.ok(tx.data.startsWith("0x42966c68"), "expected burn selector 0x42966c68");
  });

  it("buildRebalanceCalldata wraps four calls in multicall", () => {
    const tx = buildRebalanceCalldata({
      position,
      liquidity: BigInt(position.liquidity),
      newTickLower: -198_500,
      newTickUpper: -197_500,
      amount0Desired: "50000000000000000",
      amount1Desired: "100000000",
      amount0Min: "0",
      amount1Min: "0",
      recipient,
    });
    // multicall(bytes[]) selector is 0xac9650d8
    assert.ok(tx.data.startsWith("0xac9650d8"), "expected multicall selector 0xac9650d8");
    assert.equal(tx.to, nfpmFor(42161));
    assert.match(tx.description, /rebalance 42/u);
  });
});
