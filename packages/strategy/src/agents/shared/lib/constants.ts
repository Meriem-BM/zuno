import type { RiskProfile } from "@zuno/core";

export const REBALANCE_GAS_UNITS = 350_000;
export const ETH_PRICE_USD_FALLBACK = 2400;
export const MAX_CENTER_OFFSET_TICKS = 2400;

export const BUFFER_FLOOR_HOURS: Record<RiskProfile, number> = {
  conservative: 36,
  balanced: 24,
  aggressive: 14,
};

export const GAS_YIELD_CEILING: Record<RiskProfile, number> = {
  conservative: 1.2,
  balanced: 1.6,
  aggressive: 2.4,
};
