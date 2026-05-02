import type { ChainId, Plan } from "@zuno/core";
import type { SimulationStep } from "./types.js";

export function pairLabel(plan: Plan): string {
  return `${plan.snapshot.position.pool.token0.symbol}/${plan.snapshot.position.pool.token1.symbol}`;
}

export function executionSteps(plan: Plan): SimulationStep[] {
  const pair = pairLabel(plan);
  const slippage = `${(slippageBps(plan) / 100).toFixed(2)}%`;
  return [
    {
      label: "collect",
      detail: `collect unclaimed ${pair} fees from position ${plan.positionId}`,
    },
    {
      label: "remove",
      detail: `remove liquidity with ${slippage} slippage guard`,
    },
    {
      label: "prepare",
      detail:
        plan.recommended.prepAction ??
        `inventory fits target ${plan.recommended.priceLower.toFixed(2)} to ${plan.recommended.priceUpper.toFixed(2)}`,
    },
    {
      label: "mint",
      detail: `mint ${plan.recommended.kind} range with ${slippage} min-amount guard`,
    },
  ];
}

export function estimateGas(chainId: ChainId): { label: string; usd: number; gwei: number } {
  const v4MintBurnGas = 420_000;
  const ethProxyUsd = 2000;
  const gwei =
    chainId === 1
      ? 30
      : chainId === 8453
        ? 0.04
        : chainId === 10
          ? 0.001
          : chainId === 42161
            ? 0.07
            : 0.001;
  const eth = (gwei * v4MintBurnGas) / 1e9;
  const usd = eth * ethProxyUsd;
  const label =
    chainId === 1
      ? `~${eth.toFixed(4)} ETH (≈$${usd.toFixed(2)})`
      : `~${eth.toFixed(6)} ETH (≈$${usd.toFixed(2)})`;
  return { label, usd, gwei };
}

export function gasUsdFromUnits(units: string, gwei: number): number {
  const gas = Number(units);
  if (!Number.isFinite(gas)) return 0;
  return ((gas * gwei) / 1e9) * 2000;
}

export function slippageBps(plan: Plan): number {
  return plan.recommended.slippageBps ?? 50;
}

export function applySlippage(amount: string, bps: number): string {
  const n = safeBigInt(amount);
  if (n <= 0n) return "0";
  return ((n * BigInt(10_000 - bps)) / 10_000n).toString();
}

export function hasShortfall(plan: Plan): boolean {
  return (
    safeBigInt(plan.recommended.shortfall0 ?? "0") > 0n ||
    safeBigInt(plan.recommended.shortfall1 ?? "0") > 0n
  );
}

export function safeBigInt(value: string): bigint {
  try {
    return BigInt(value || "0");
  } catch {
    return 0n;
  }
}

export function parseLiquidity(value: string): bigint | null {
  const n = safeBigInt(value);
  return n > 0n ? n : null;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
