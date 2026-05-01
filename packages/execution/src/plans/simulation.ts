import { simulatePreparedTransaction } from "@zuno/chain/uniswap";
import type { Plan } from "@zuno/core";
import { buildExecutionTransaction } from "./transaction.js";
import type { PlanSimulation, SimulationOptions } from "./types.js";
import {
  estimateGas,
  executionSteps,
  gasUsdFromUnits,
  hasShortfall,
  pairLabel,
  slippageBps,
} from "./utils.js";

export async function simulatePlan(
  plan: Plan,
  options: SimulationOptions = {},
): Promise<PlanSimulation> {
  const warnings: string[] = [];
  if (plan.risk.verdict === "approve_with_caution") {
    warnings.push("risk review approved with caution; inspect slippage and gas before signing");
  }
  if (!plan.snapshot.range.inRange) {
    warnings.push("current position is out of range, so execution may require swapping inventory");
  }
  if (hasShortfall(plan)) {
    warnings.push(plan.recommended.prepAction ?? "target range needs inventory prep before apply");
  }

  const gas = estimateGas(plan.snapshot.position.pool.chainId);
  const transaction = options.account
    ? buildExecutionTransaction(plan, options.account)
    : undefined;
  let onchainStatus: PlanSimulation["onchainStatus"] = "not_checked";
  let estimatedGasUnits: string | undefined;
  let revertReason: string | undefined;

  if (options.checkChain && options.account && transaction) {
    const simulated = await simulatePreparedTransaction(
      {
        chainId: transaction.chainId,
        to: transaction.to,
        data: transaction.data,
        value: transaction.value ?? "0",
        description: `rebalance ${plan.positionId}`,
      },
      options.account,
    );
    onchainStatus = simulated.ok ? "passed" : "failed";
    estimatedGasUnits = simulated.gasUnits;
    revertReason = simulated.reason;
    if (!simulated.ok) warnings.push(`onchain simulation failed: ${simulated.reason}`);
  } else if (options.checkChain && !transaction) {
    warnings.push("onchain simulation skipped because deterministic calldata could not be built");
  }

  return {
    planId: plan.id,
    positionId: plan.positionId,
    pair: pairLabel(plan),
    feeTier: plan.snapshot.position.pool.feeTier,
    oldRange: {
      priceLower: plan.snapshot.range.priceLower,
      priceUpper: plan.snapshot.range.priceUpper,
    },
    targetRange: {
      priceLower: plan.recommended.priceLower,
      priceUpper: plan.recommended.priceUpper,
    },
    steps: executionSteps(plan),
    estimatedGas: estimatedGasUnits ? `${estimatedGasUnits} gas units` : gas.label,
    estimatedGasUnits,
    estimatedGasUsd: estimatedGasUnits ? gasUsdFromUnits(estimatedGasUnits, gas.gwei) : gas.usd,
    estimatedSlippage: slippageBps(plan) / 10_000,
    onchainStatus,
    revertReason,
    warnings,
    canApply:
      plan.risk.verdict !== "reject" &&
      !hasShortfall(plan) &&
      (onchainStatus === "not_checked" || onchainStatus === "passed"),
  };
}
