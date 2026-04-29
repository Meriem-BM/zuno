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
} from "../src/index.js";

const owner = "0xabc1230000000000000000000000000000000def" as Address;
const token0 = token("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", "WETH", 18);
const token1 = token("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "USDC", 6);
const poolAddress = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640" as Address;

describe("position reads", () => {
  it("lists NFT positions for the owner", async () => {
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
      address: poolAddress,
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
    feesOwed0: "8200000000000000",
    feesOwed1: "12400000",
  };
}

function reader(): ContractReader {
  return {
    async readContract(args) {
      if (args.functionName === "balanceOf") return 2n;
      if (args.functionName === "tokenOfOwnerByIndex") {
        return (args.args?.[1] as bigint) === 0n ? 42n : 43n;
      }
      if (args.functionName === "ownerOf") return owner;
      if (args.functionName === "positions") {
        const tokenId = args.args?.[0] as bigint;
        const isFirst = tokenId === 42n;
        return [
          0n,
          "0x0000000000000000000000000000000000000000",
          token0.address,
          token1.address,
          500,
          isFirst ? -199_400 : -198_900,
          isFirst ? -198_400 : -197_700,
          5_840_291_203_487_120_349n,
          0n,
          0n,
          8_200_000_000_000_000n,
          12_400_000n,
        ];
      }
      if (args.functionName === "symbol") {
        return args.address.toLowerCase() === token0.address ? "WETH" : "USDC";
      }
      if (args.functionName === "decimals") {
        return args.address.toLowerCase() === token0.address ? 18 : 6;
      }
      if (args.functionName === "getPool") return poolAddress;
      if (args.functionName === "slot0") return [0n, -198_330, 0, 0, 0, 0, true];
      if (args.functionName === "liquidity") return 12_345_678_901_234_567_890n;
      throw new Error(`unexpected read ${args.functionName}`);
    },
  };
}
