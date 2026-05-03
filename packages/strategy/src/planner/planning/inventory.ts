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

export interface CreateAllocationInput {
  pool: Pool;
  tickLower: number;
  tickUpper: number;
  capitalAmount: bigint;
  capitalToken: "token0" | "token1";
}

export interface CreateAllocation {
  amount0: string;
  amount1: string;
  needsSwap: boolean;
  prepAction?: string;
}

export interface TwoSidedCreateAllocationInput {
  pool: Pool;
  tickLower: number;
  tickUpper: number;
  amount0Provided: bigint;
  amount1Provided: bigint;
}

export function allocateForCreateTwoSided(input: TwoSidedCreateAllocationInput): CreateAllocation {
  const { pool, tickLower, tickUpper, amount0Provided, amount1Provided } = input;
  if (amount0Provided <= 0n && amount1Provided <= 0n) {
    return { amount0: "0", amount1: "0", needsSwap: false };
  }

  const sqrtCurrent = naturalSqrtPrice(pool, pool.currentTick);
  const sqrtLower = naturalSqrtPrice(pool, tickLower);
  const sqrtUpper = naturalSqrtPrice(pool, tickUpper);

  const a0 = atomicToNumber(amount0Provided, pool.token0.decimals);
  const a1 = atomicToNumber(amount1Provided, pool.token1.decimals);

  let amount0Natural = 0;
  let amount1Natural = 0;

  if (pool.currentTick <= tickLower) {
    amount0Natural = a0;
    amount1Natural = 0;
  } else if (pool.currentTick >= tickUpper) {
    amount0Natural = 0;
    amount1Natural = a1;
  } else {
    const lFrom0 = (a0 * sqrtCurrent * sqrtUpper) / (sqrtUpper - sqrtCurrent);
    const lFrom1 = a1 / (sqrtCurrent - sqrtLower);
    const liquidity = Math.min(lFrom0, lFrom1);
    if (Number.isFinite(liquidity) && liquidity > 0) {
      amount0Natural = (liquidity * (sqrtUpper - sqrtCurrent)) / (sqrtCurrent * sqrtUpper);
      amount1Natural = liquidity * (sqrtCurrent - sqrtLower);
    }
  }

  return {
    amount0: decimalToAtomic(Math.max(0, amount0Natural), pool.token0.decimals).toString(),
    amount1: decimalToAtomic(Math.max(0, amount1Natural), pool.token1.decimals).toString(),
    needsSwap: false,
  };
}

export function allocateForCreate(input: CreateAllocationInput): CreateAllocation {
  const { pool, tickLower, tickUpper, capitalAmount, capitalToken } = input;
  if (capitalAmount <= 0n) {
    return { amount0: "0", amount1: "0", needsSwap: false };
  }

  const sqrtLower = naturalSqrtPrice(pool, tickLower);
  const sqrtUpper = naturalSqrtPrice(pool, tickUpper);

  const capitalNatural = atomicToNumber(
    capitalAmount,
    capitalToken === "token0" ? pool.token0.decimals : pool.token1.decimals,
  );
  if (!Number.isFinite(capitalNatural) || capitalNatural <= 0) {
    return { amount0: "0", amount1: "0", needsSwap: false };
  }

  let liquidity: number;
  let amount0Natural: number;
  let amount1Natural: number;

  if (pool.currentTick <= tickLower) {
    if (capitalToken === "token1") {
      liquidity = 0;
      amount0Natural = capitalNatural / pool.price;
      amount1Natural = 0;
    } else {
      liquidity = (capitalNatural * sqrtLower * sqrtUpper) / (sqrtUpper - sqrtLower);
      amount0Natural = capitalNatural;
      amount1Natural = 0;
    }
  } else if (pool.currentTick >= tickUpper) {
    if (capitalToken === "token0") {
      liquidity = 0;
      amount0Natural = 0;
      amount1Natural = capitalNatural * pool.price;
    } else {
      liquidity = capitalNatural / (sqrtUpper - sqrtLower);
      amount0Natural = 0;
      amount1Natural = capitalNatural;
    }
  } else {
    const totalValue1 = capitalToken === "token0" ? capitalNatural * pool.price : capitalNatural;
    const desired = centeredNaturalAmounts(pool, tickLower, tickUpper, totalValue1);
    liquidity = desired.liquidity;
    amount0Natural = desired.amount0;
    amount1Natural = desired.amount1;
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
  const heldByCapital0 = capitalToken === "token0" ? capitalAmount : 0n;
  const heldByCapital1 = capitalToken === "token1" ? capitalAmount : 0n;
  const shortfall0 = amount0 > heldByCapital0 ? amount0 - heldByCapital0 : 0n;
  const shortfall1 = amount1 > heldByCapital1 ? amount1 - heldByCapital1 : 0n;
  const needsSwap = shortfall0 > 0n || shortfall1 > 0n;

  let prepAction: string | undefined;
  if (needsSwap) {
    if (shortfall1 > 0n && capitalToken === "token0") {
      const amountIn = heldByCapital0 > amount0 ? heldByCapital0 - amount0 : 0n;
      const amountInDecimal = formatAtomic(amountIn, pool.token0.decimals);
      prepAction = `swap ~${amountInDecimal} ${pool.token0.symbol} → ${pool.token1.symbol} first to cover the range`;
    } else if (shortfall0 > 0n && capitalToken === "token1") {
      const amountIn = heldByCapital1 > amount1 ? heldByCapital1 - amount1 : 0n;
      const amountInDecimal = formatAtomic(amountIn, pool.token1.decimals);
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

function centeredNaturalAmounts(
  pool: Pool,
  tickLower: number,
  tickUpper: number,
  totalValue1: number,
): { amount0: number; amount1: number; liquidity: number } {
  if (!Number.isFinite(totalValue1) || totalValue1 <= 0 || pool.price <= 0) {
    return { amount0: 0, amount1: 0, liquidity: 0 };
  }

  const sqrtCurrent = naturalSqrtPrice(pool, pool.currentTick);
  const sqrtLower = naturalSqrtPrice(pool, tickLower);
  const sqrtUpper = naturalSqrtPrice(pool, tickUpper);
  const unit0 = (sqrtUpper - sqrtCurrent) / (sqrtCurrent * sqrtUpper);
  const unit1 = sqrtCurrent - sqrtLower;
  const unitValue1 = unit0 * pool.price + unit1;
  if (!Number.isFinite(unitValue1) || unitValue1 <= 0) {
    return { amount0: 0, amount1: 0, liquidity: 0 };
  }

  const liquidity = totalValue1 / unitValue1;
  return {
    amount0: liquidity * unit0,
    amount1: liquidity * unit1,
    liquidity,
  };
}

function naturalSqrtPrice(pool: Pool, tick: number): number {
  const decimalScale = Math.pow(10, pool.token0.decimals - pool.token1.decimals);
  return Math.sqrt(Math.pow(1.0001, tick) * decimalScale);
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
