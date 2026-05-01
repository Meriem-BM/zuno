export const Q96 = 2n ** 96n;

export function tickToRawPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

/**
 * Convert a raw v3 tick to a human-readable price token1/token0 (e.g. USDC per
 * ETH, where token0 is WETH, token1 is USDC).
 */
export function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  return tickToRawPrice(tick) * Math.pow(10, decimals0 - decimals1);
}

export function priceToTick(price: number, decimals0: number, decimals1: number): number {
  const raw = price * Math.pow(10, decimals1 - decimals0);
  return Math.floor(Math.log(raw) / Math.log(1.0001));
}

/** Round to the nearest valid tick on a given spacing. */
export function nearestUsableTick(tick: number, tickSpacing: number): number {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing;
  return rounded;
}

/** Distance from `tick` to whichever range boundary is closer. */
export function distanceFromBoundary(tick: number, tickLower: number, tickUpper: number): number {
  if (tick < tickLower) return tickLower - tick;
  if (tick > tickUpper) return tick - tickUpper;
  return Math.min(tick - tickLower, tickUpper - tick);
}

/**
 * Where in [0, 1] the current tick sits between lower and upper.
 * 0 = at lower bound, 1 = at upper bound, <0 / >1 = out of range.
 */
export function utilization(tick: number, tickLower: number, tickUpper: number): number {
  const width = tickUpper - tickLower;
  if (width <= 0) return 0;
  return (tick - tickLower) / width;
}

export function inRange(tick: number, tickLower: number, tickUpper: number): boolean {
  return tick >= tickLower && tick <= tickUpper;
}
