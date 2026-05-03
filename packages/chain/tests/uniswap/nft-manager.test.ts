import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chainConfig } from "@zuno/chain/config";
import type { Address, Position, Token } from "@zuno/core";
import { decodeAbiParameters, decodeFunctionData } from "viem";
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
const nativeEth: Token = {
  address: "0x0000000000000000000000000000000000000000" as Address,
  symbol: "ETH",
  decimals: 18,
};

const position: Position = {
  id: "42",
  owner: recipient,
  pool: {
    address: "0x000000000004444c5dc75cB358380D2e3dE08A90" as Address,
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
  it("nfpmFor returns the Base v4 position manager", () => {
    assert.equal(nfpmFor(8453), chainConfig(8453).positionManager);
  });

  it("buildMint encodes the modifyLiquidities target", () => {
    const tx = buildMint({
      token0,
      token1,
      fee: 500,
      tickLower: -200_000,
      tickUpper: -190_000,
      currentTick: -198_330,
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
    assert.ok(tx.data.startsWith("0x"), "expected encoded calldata");
    assert.match(tx.description, /mint WETH\/USDC 0\.05%/u);
  });

  it("buildMint sweeps excess native ETH for ETH positions", () => {
    const tx = buildMint({
      token0: nativeEth,
      token1,
      fee: 3000,
      tickLower: -200_000,
      tickUpper: -190_000,
      currentTick: -198_330,
      amount0Desired: "100000000000000000",
      amount1Desired: "200000000",
      amount0Min: "0",
      amount1Min: "0",
      recipient,
      deadline: 1_900_000_000,
      chainId: 11155111,
    });
    assert.equal(tx.value, "100000000000000000");
    const decoded = decodeFunctionData({
      abi: [
        {
          type: "function",
          name: "modifyLiquidities",
          inputs: [
            { type: "bytes", name: "unlockData" },
            { type: "uint256", name: "deadline" },
          ],
          outputs: [],
          stateMutability: "payable",
        },
      ],
      data: tx.data,
    });
    const [actions, params] = decodeAbiParameters(
      [{ type: "bytes" }, { type: "bytes[]" }],
      decoded.args[0],
    );
    const mint = decodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { type: "address" },
            { type: "address" },
            { type: "uint24" },
            { type: "int24" },
            { type: "address" },
          ],
        },
        { type: "int24" },
        { type: "int24" },
        { type: "uint256" },
        { type: "uint128" },
        { type: "uint128" },
        { type: "address" },
        { type: "bytes" },
      ],
      params[0],
    );
    assert.equal(actions, "0x020d14");
    assert.equal(params.length, 3);
    assert.ok(mint[3] > 0n);
  });

  it("buildIncreaseLiquidity encodes calldata", () => {
    const tx = buildIncreaseLiquidity(
      {
        tokenId: 42n,
        liquidity: 1_000_000n,
        amount0Max: "50000000000000000",
        amount1Max: "100000000",
        chainId: 42161,
      },
      token0,
      token1,
    );
    assert.ok(tx.data.startsWith("0x"), "expected encoded calldata");
  });

  it("buildDecreaseLiquidity encodes calldata", () => {
    const tx = buildDecreaseLiquidity({
      tokenId: 42n,
      liquidity: 1_000_000n,
      amount0Min: "0",
      amount1Min: "0",
      chainId: 42161,
    });
    assert.ok(tx.data.startsWith("0x"), "expected encoded calldata");
  });

  it("buildCollect encodes calldata", () => {
    const tx = buildCollect({
      tokenId: 42n,
      recipient,
      token0: token0.address,
      token1: token1.address,
      amount0Max: "",
      amount1Max: "",
      chainId: 42161,
    });
    assert.ok(tx.data.startsWith("0x"), "expected encoded calldata");
  });

  it("buildBurn encodes calldata", () => {
    const tx = buildBurn({ tokenId: 42n, chainId: 42161 });
    assert.ok(tx.data.startsWith("0x"), "expected encoded calldata");
  });

  it("buildRebalanceCalldata builds a modifyLiquidities transaction", () => {
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
    assert.equal(tx.to, nfpmFor(42161));
    assert.ok(tx.data.startsWith("0x"), "expected encoded calldata");
    assert.match(tx.description, /rebalance 42/u);
  });
});
