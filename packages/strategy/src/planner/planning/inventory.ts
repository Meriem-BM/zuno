import type { Pool, PositionSnapshot } from "@zuno/core";

const ZERO = 0n;

export interface InventoryAllocation {
  deploy0: string;
  deploy1: string;
  residual0: string;
  residual1: string;
  required0: string;
  required1: string;
  shortfall0: string;
  shortfall1: string;
  prepAction?: string;
}

export function allocateInventory(
  snapshot: PositionSnapshot,
  tickLower: number,
  tickUpper: number,
): InventoryAllocation {
  const { position } = snapshot;
  const available0 = addAtomic(position.amount0, position.feesOwed0);
  const available1 = addAtomic(position.amount1, position.feesOwed1);
  const desired = targetAmountsForRange(snapshot, tickLower, tickUpper, available0, available1);
  const deploy0 = minBigInt(available0, desired.amount0);
  const deploy1 = minBigInt(available1, desired.amount1);
  const shortfall0 = desired.amount0 > available0 ? desired.amount0 - available0 : ZERO;
  const shortfall1 = desired.amount1 > available1 ? desired.amount1 - available1 : ZERO;
  const residual0 = available0 > deploy0 ? available0 - deploy0 : ZERO;
  const residual1 = available1 > deploy1 ? available1 - deploy1 : ZERO;
  const prepAction = prepActionForShortfall(snapshot, shortfall0, shortfall1);

  return {
    deploy0: deploy0.toString(),
    deploy1: deploy1.toString(),
    residual0: residual0.toString(),
    residual1: residual1.toString(),
    required0: desired.amount0.toString(),
    required1: desired.amount1.toString(),
    shortfall0: shortfall0.toString(),
    shortfall1: shortfall1.toString(),
    prepAction,
  };
}

function targetAmountsForRange(
  snapshot: PositionSnapshot,
  tickLower: number,
  tickUpper: number,
  available0: bigint,
  available1: bigint,
): { amount0: bigint; amount1: bigint } {
  const { pool } = snapshot.position;
  const unit = unitAmounts(pool.currentTick, tickLower, tickUpper);
  const value1 =
    atomicToNumber(available0, pool.token0.decimals) * pool.price +
    atomicToNumber(available1, pool.token1.decimals);

  if (!Number.isFinite(value1) || value1 <= 0) return { amount0: ZERO, amount1: ZERO };
  if (unit.amount0 === 0 && unit.amount1 === 0) return { amount0: ZERO, amount1: ZERO };
  if (unit.amount0 > 0 && unit.amount1 === 0) {
    return { amount0: decimalToAtomic(value1 / pool.price, pool.token0.decimals), amount1: ZERO };
  }
  if (unit.amount1 > 0 && unit.amount0 === 0) {
    return { amount0: ZERO, amount1: decimalToAtomic(value1, pool.token1.decimals) };
  }

  const unit0 = BigInt(Math.floor(unit.amount0));
  const unit1 = BigInt(Math.floor(unit.amount1));
  const unitValue1 =
    atomicToNumber(unit0, pool.token0.decimals) * pool.price +
    atomicToNumber(unit1, pool.token1.decimals);
  if (!Number.isFinite(unitValue1) || unitValue1 <= 0) {
    return { amount0: ZERO, amount1: ZERO };
  }

  const token0Share = (atomicToNumber(unit0, pool.token0.decimals) * pool.price) / unitValue1;
  const amount0 = decimalToAtomic((value1 * token0Share) / pool.price, pool.token0.decimals);
  const amount1 = decimalToAtomic(value1 * (1 - token0Share), pool.token1.decimals);
  return { amount0, amount1 };
}

function unitAmounts(
  currentTick: number,
  tickLower: number,
  tickUpper: number,
): { amount0: number; amount1: number } {
  const l = 1e18;
  const sqrtLower = Math.sqrt(Math.pow(1.0001, tickLower));
  const sqrtUpper = Math.sqrt(Math.pow(1.0001, tickUpper));
  const sqrtCurrent = Math.sqrt(Math.pow(1.0001, currentTick));

  if (currentTick <= tickLower) {
    return { amount0: (l * (sqrtUpper - sqrtLower)) / (sqrtLower * sqrtUpper), amount1: 0 };
  }
  if (currentTick >= tickUpper) {
    return { amount0: 0, amount1: l * (sqrtUpper - sqrtLower) };
  }
  return {
    amount0: (l * (sqrtUpper - sqrtCurrent)) / (sqrtCurrent * sqrtUpper),
    amount1: l * (sqrtCurrent - sqrtLower),
  };
}

function prepActionForShortfall(
  snapshot: PositionSnapshot,
  shortfall0: bigint,
  shortfall1: bigint,
): string | undefined {
  if (shortfall0 <= ZERO && shortfall1 <= ZERO) return undefined;
  const { token0, token1 } = snapshot.position.pool;
  const missing: string[] = [];
  if (shortfall0 > ZERO) missing.push(`${shortfall0.toString()} ${token0.symbol}`);
  if (shortfall1 > ZERO) missing.push(`${shortfall1.toString()} ${token1.symbol}`);
  return `Prep needed before execution: acquire ${missing.join(" and ")} for the target range.`;
}

function addAtomic(a: string, b: string): bigint {
  return safeBigInt(a) + safeBigInt(b);
}

function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function safeBigInt(value: string): bigint {
  try {
    return BigInt(value || "0");
  } catch {
    return ZERO;
  }
}

function atomicToNumber(value: bigint, decimals: number): number {
  return Number(value) / 10 ** decimals;
}

/**
 * Allocate a single-token capital across (token0, token1) for a brand-new
 * range, given the pool's current tick and the user's chosen [lower, upper].
 *
 * The user provides X of one token; we compute the optimal split assuming
 * the entire deposit value (in token1 terms via pool.price) sits inside
 * the range. If the input token alone can't cover the required other-side
 * amount, we surface a `swapBeforeMint` prep action describing the swap
 * the user (or an upstream tool) needs to do first.
 */
export interface CreateAllocationInput {
  pool: Pool;
  tickLower: number;
  tickUpper: number;
  // Atomic units of the capital token.
  capitalAmount: bigint;
  capitalToken: "token0" | "token1";
}

export interface CreateAllocation {
  amount0: string;
  amount1: string;
  // True when capital is single-sided AND the range needs the other side too.
  needsSwap: boolean;
  // If needsSwap, format is "swap N <fromToken> -> <toToken> first".
  prepAction?: string;
}

export function allocateForCreate(input: CreateAllocationInput): CreateAllocation {
  const { pool, tickLower, tickUpper, capitalAmount, capitalToken } = input;
  if (capitalAmount <= 0n) {
    return { amount0: "0", amount1: "0", needsSwap: false };
  }

  const sqrtLower = Math.sqrt(Math.pow(1.0001, tickLower));
  const sqrtUpper = Math.sqrt(Math.pow(1.0001, tickUpper));
  const sqrtCurrent = Math.sqrt(Math.pow(1.0001, pool.currentTick));

  const capitalNatural = atomicToNumber(
    capitalAmount,
    capitalToken === "token0" ? pool.token0.decimals : pool.token1.decimals,
  );
  if (!Number.isFinite(capitalNatural) || capitalNatural <= 0) {
    return { amount0: "0", amount1: "0", needsSwap: false };
  }

  // Compute liquidity from the capital side, then back-fill the other side.
  // All math here is in natural-decimal units (capitalNatural is already
  // scaled). Liquidity formula matches Uniswap v3/v4 for non-stablish pools.
  let liquidity: number;
  let amount0Natural: number;
  let amount1Natural: number;

  if (pool.currentTick <= tickLower) {
    // Range entirely above current price: only token0 needed.
    if (capitalToken === "token1") {
      // User has token1 but range needs token0 - must swap fully first.
      liquidity = 0;
      amount0Natural = capitalNatural / pool.price; // approximate post-swap
      amount1Natural = 0;
    } else {
      liquidity = (capitalNatural * sqrtLower * sqrtUpper) / (sqrtUpper - sqrtLower);
      amount0Natural = capitalNatural;
      amount1Natural = 0;
    }
  } else if (pool.currentTick >= tickUpper) {
    // Range entirely below current price: only token1 needed.
    if (capitalToken === "token0") {
      liquidity = 0;
      amount0Natural = 0;
      amount1Natural = capitalNatural * pool.price; // approximate post-swap
    } else {
      liquidity = capitalNatural / (sqrtUpper - sqrtLower);
      amount0Natural = 0;
      amount1Natural = capitalNatural;
    }
  } else {
    // Centered: both tokens needed. Liquidity is bounded by the side the user supplies.
    if (capitalToken === "token0") {
      liquidity = (capitalNatural * sqrtCurrent * sqrtUpper) / (sqrtUpper - sqrtCurrent);
      amount0Natural = capitalNatural;
      amount1Natural = liquidity * (sqrtCurrent - sqrtLower);
    } else {
      liquidity = capitalNatural / (sqrtCurrent - sqrtLower);
      amount1Natural = capitalNatural;
      amount0Natural = (liquidity * (sqrtUpper - sqrtCurrent)) / (sqrtCurrent * sqrtUpper);
    }
  }

  if (!Number.isFinite(liquidity) || liquidity < 0) {
    return { amount0: "0", amount1: "0", needsSwap: false };
  }

  const amount0 = decimalToAtomic(Math.max(0, amount0Natural), pool.token0.decimals);
  const amount1 = decimalToAtomic(Math.max(0, amount1Natural), pool.token1.decimals);
  return prepFor(pool, capitalToken, capitalAmount, amount0, amount1);
}

function prepFor(
  pool: Pool,
  capitalToken: "token0" | "token1",
  capitalAmount: bigint,
  amount0: bigint,
  amount1: bigint,
): CreateAllocation {
  // The capital covers the side it came in. Compute shortfall on the other side.
  const heldByCapital0 = capitalToken === "token0" ? capitalAmount : 0n;
  const heldByCapital1 = capitalToken === "token1" ? capitalAmount : 0n;
  const shortfall0 = amount0 > heldByCapital0 ? amount0 - heldByCapital0 : 0n;
  const shortfall1 = amount1 > heldByCapital1 ? amount1 - heldByCapital1 : 0n;
  const needsSwap = shortfall0 > 0n || shortfall1 > 0n;

  // Only surface a prep step for a clear cross-token swap. The speculative
  // "acquire additional X" fallback fired on float roundoff; the authoritative
  // balance check now lives in prepareCreateApply at apply time.
  let prepAction: string | undefined;
  if (needsSwap) {
    if (shortfall1 > 0n && capitalToken === "token0" && amount0 > heldByCapital0) {
      const amountInDecimal = formatAtomic(amount0 - heldByCapital0, pool.token0.decimals);
      prepAction = `swap ~${amountInDecimal} ${pool.token0.symbol} → ${pool.token1.symbol} first to cover the range`;
    } else if (shortfall0 > 0n && capitalToken === "token1" && amount1 > heldByCapital1) {
      const amountInDecimal = formatAtomic(amount1 - heldByCapital1, pool.token1.decimals);
      prepAction = `swap ~${amountInDecimal} ${pool.token1.symbol} → ${pool.token0.symbol} first to cover the range`;
    }
  }

  return {
    amount0: amount0.toString(),
    amount1: amount1.toString(),
    needsSwap,
    prepAction,
  };
}

function formatAtomic(value: bigint, decimals: number): string {
  if (value <= 0n) return "0";
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = value % scale;
  if (fraction === 0n) return whole.toString();
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/u, "");
  return fractionStr ? `${whole.toString()}.${fractionStr}` : whole.toString();
}

function decimalToAtomic(value: number, decimals: number): bigint {
  if (!Number.isFinite(value) || value <= 0) return ZERO;
  const fixed = value.toFixed(Math.min(decimals, 18));
  const [intPart = "0", fracPart = ""] = fixed.split(".");
  const padded = fracPart.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(intPart) * 10n ** BigInt(decimals) + BigInt(padded || "0");
}
