import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Address, Position, Token } from "@zuno/core";
import {
  buildSnapshot,
  getPosition,
  isRiskyPosition,
  listPositions,
  pairName,
  rangeStatus,
  tickToPrice,
  type ContractReader,
} from "../../src/uniswap/index.js";

const owner = "0xabc1230000000000000000000000000000000def" as Address;
const token0 = token("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", "WETH", 18);
const token1 = token("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "USDC", 6);

describe("position reads", () => {
  it("lists v4 positions for the owner", async () => {
    const positions = await listPositions(owner, { chainId: 1, client: reader() });
    assert.equal(positions.length, 2);
    assert.deepEqual(
      positions.map((position) => position.id),
      ["42", "43"],
    );
    assert.ok(positions.every((position) => position.owner === owner));
  });

  it("rejects non-numeric position ids", async () => {
    await assert.rejects(
      () => getPosition("pos_4f2a3b", { chainId: 1, owner, client: reader() }),
      /numeric NFT token id/u,
    );
  });

  it("builds an out-of-range snapshot", async () => {
    const position = await getPosition("42", { chainId: 1, owner, client: reader() });
    const snapshot = buildSnapshot(position);
    assert.equal(pairName(position), "WETH/USDC");
    assert.equal(rangeStatus(snapshot), "OUT_OF_RANGE");
    assert.equal(isRiskyPosition(snapshot), true);
    assert.ok(snapshot.range.priceLower < snapshot.range.priceUpper);
    assert.ok(snapshot.range.priceCurrent > 0);
  });

  it("keeps in-range utilization inside the band", async () => {
    const snapshot = buildSnapshot(position("43", -198_900, -197_700, -198_330));
    assert.equal(rangeStatus(snapshot), "IN_RANGE");
    assert.ok(snapshot.range.utilization > 0);
    assert.ok(snapshot.range.utilization < 1);
  });
});

function token(address: Address, symbol: string, decimals: number): Token {
  return { address, symbol, decimals };
}

function position(id: string, tickLower: number, tickUpper: number, currentTick: number): Position {
  return {
    id,
    owner,
    pool: {
      address: "0x000000000004444c5dc75cB358380D2e3dE08A90" as Address,
      chainId: 1,
      token0,
      token1,
      feeTier: 500,
      tickSpacing: 10,
      currentTick,
      sqrtPriceX96: "0",
      liquidity: "12345678901234567890",
      price: tickToPrice(currentTick, token0.decimals, token1.decimals),
    },
    tickLower,
    tickUpper,
    liquidity: "5840291203487120349",
    amount0: "418000000000000000",
    amount1: "0",
    feesOwed0: "0",
    feesOwed1: "0",
  };
}

function reader(): ContractReader {
  return {
    async readContract(args) {
      if (args.functionName === "nextTokenId") return 44n;
      if (args.functionName === "ownerOf") {
        const tokenId = args.args?.[0] as bigint;
        return tokenId === 42n || tokenId === 43n ? owner : "0x0000000000000000000000000000000000000001";
      }
      if (args.functionName === "getPoolAndPositionInfo") {
        const tokenId = args.args?.[0] as bigint;
        const isFirst = tokenId === 42n;
        return [
          [token0.address, token1.address, 500, 10, "0x0000000000000000000000000000000000000000"],
          packPositionInfo(isFirst ? -199_400 : -198_900, isFirst ? -198_400 : -197_700),
        ];
      }
      if (args.functionName === "getPositionLiquidity") {
        return 5_840_291_203_487_120_349n;
      }
      if (args.functionName === "getSlot0") return [0n, -198_330, 0, 0];
      if (args.functionName === "getLiquidity") return 12_345_678_901_234_567_890n;
      if (args.functionName === "getPositionInfo") {
        return [5_840_291_203_487_120_349n, 9_999n, 9_999n];
      }
      if (args.functionName === "getFeeGrowthInside") return [9_999n, 9_999n];
      if (args.functionName === "symbol") {
        return args.address.toLowerCase() === token0.address ? "WETH" : "USDC";
      }
      if (args.functionName === "decimals") {
        return args.address.toLowerCase() === token0.address ? 18 : 6;
      }
      throw new Error(`unexpected read ${args.functionName}`);
    },
  };
}

function packPositionInfo(tickLower: number, tickUpper: number): bigint {
  const hasSubscriber = 0n;
  const lower = packInt24(tickLower);
  const upper = packInt24(tickUpper);
  return hasSubscriber | (lower << 8n) | (upper << 32n) | (1n << 56n);
}

function packInt24(value: number): bigint {
  return BigInt(value < 0 ? value + 0x1000000 : value);
}
