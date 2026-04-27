import type { Pool, Position, Token } from "@zuno/core";
import { tickToPrice } from "./tick-math.js";

const USDC: Token = {
  address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  symbol: "USDC",
  decimals: 6,
};

const WETH: Token = {
  address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  symbol: "WETH",
  decimals: 18,
};

const ARB: Token = {
  address: "0x912ce59144191c1204e64559fe8253a0e49e6548",
  symbol: "ARB",
  decimals: 18,
};

function pool(
  address: `0x${string}`,
  token0: Token,
  token1: Token,
  feeTier: number,
  tickSpacing: number,
  currentTick: number,
): Pool {
  return {
    address,
    chainId: 1,
    token0,
    token1,
    feeTier,
    tickSpacing,
    currentTick,
    sqrtPriceX96: "0",
    liquidity: "12345678901234567890",
    price: tickToPrice(currentTick, token0.decimals, token1.decimals),
  };
}

const ethUsdc05 = pool(
  "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
  WETH,
  USDC,
  500,
  10,
  // ~ price 2073.62 USDC per ETH
  -198_330,
);

const arbUsdc03 = pool(
  "0xc31e54c7a869b9fcbecc14363cf510d1c41fa443",
  ARB,
  USDC,
  3_000,
  60,
  -90_120,
);

export const FIXTURE_POSITIONS: Position[] = [
  {
    id: "pos_4f2a3b",
    owner: "0xabc1230000000000000000000000000000000def",
    pool: ethUsdc05,
    // out of range: pool tick is -198330, position covers -199400..-198400
    tickLower: -199_400,
    tickUpper: -198_400,
    liquidity: "5840291203487120349",
    amount0: "418000000000000000", // ~0.418 WETH
    amount1: "0",
    feesOwed0: "8200000000000000",
    feesOwed1: "12_400000".replace("_", ""),
  },
  {
    id: "pos_7c91de",
    owner: "0xabc1230000000000000000000000000000000def",
    pool: ethUsdc05,
    // in range, sitting near the middle
    tickLower: -198_900,
    tickUpper: -197_700,
    liquidity: "9120349580294720384",
    amount0: "210000000000000000",
    amount1: "440000000",
    feesOwed0: "1200000000000000",
    feesOwed1: "1800000",
  },
  {
    id: "pos_a01122",
    owner: "0xabc1230000000000000000000000000000000def",
    pool: arbUsdc03,
    tickLower: -91_200,
    tickUpper: -89_400,
    liquidity: "2200349580294720384",
    amount0: "1450000000000000000000",
    amount1: "1180000000",
    feesOwed0: "0",
    feesOwed1: "0",
  },
];

export function findFixturePosition(id: string): Position | undefined {
  return FIXTURE_POSITIONS.find((p) => p.id === id);
}
