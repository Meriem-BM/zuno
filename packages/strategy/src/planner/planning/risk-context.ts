import type { PositionSnapshot } from "@zuno/core";

export interface RiskContext {
  realizedVolBps: number;
  tickTravel24h: number;
  gasGwei: number;
  feeYield24hUsd: number;
  source: string;
}

export function defaultRiskContext(snapshot: PositionSnapshot): RiskContext {
  const pool = snapshot.position.pool;
  const seed = simpleHash(`${pool.address}:${pool.feeTier}`);
  const realizedVolBps = 90 + (seed % 280); // 90..370 bps
  const tickTravel24h = Math.max(
    pool.tickSpacing * 4,
    Math.round((realizedVolBps / 100) * pool.tickSpacing * 2.4),
  );
  const gasGwei = gasEstimateGwei(pool.chainId, seed);
  const liquidityScale =
    pool.liquidity.length > 18 ? Number(pool.liquidity.slice(0, pool.liquidity.length - 12)) : 1;
  const feeYield24hUsd = Math.max(0.5, (liquidityScale * pool.feeTier) / 10_000 / 365);
  return {
    realizedVolBps,
    tickTravel24h,
    gasGwei,
    feeYield24hUsd,
    source: "deterministic-snapshot",
  };
}

function gasEstimateGwei(chainId: number, seed: number): number {
  switch (chainId) {
    case 1:
      return 28 + ((seed >> 4) % 18);
    case 8453:
      return 0.04 + ((seed >> 8) % 6) / 100;
    case 10:
      return 0.001 + ((seed >> 8) % 9) / 1000;
    default:
      return 0.06 + ((seed >> 8) % 12) / 100;
  }
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
