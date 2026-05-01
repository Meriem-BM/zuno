import type { Address, Plan } from "@zuno/core";
import { checkApprovals, checkExecutionPolicy } from "./policy.js";
import { simulatePlan } from "./simulation.js";
import { buildExecutionTransaction } from "./transaction.js";
import type { ApplyPreview, ApplyPreviewOptions } from "./types.js";

export async function prepareApply(
  plan: Plan,
  agentWalletAddress: Address,
  options: ApplyPreviewOptions = {},
): Promise<ApplyPreview> {
  const simulation = await simulatePlan(plan, { ...options, account: agentWalletAddress });
  const residual = {
    token0: plan.recommended.residual0,
    token1: plan.recommended.residual1,
  };
  const transaction = buildExecutionTransaction(plan, agentWalletAddress);
  const approvalReadiness = options.checkAllowances
    ? await checkApprovals(plan, agentWalletAddress)
    : [];
  const policy = checkExecutionPolicy(plan, transaction, simulation, approvalReadiness);
  const status = policy.allowed && transaction ? "ready_for_turnkey" : "blocked";

  return {
    planId: plan.id,
    positionId: plan.positionId,
    agentWalletAddress,
    status,
    summary:
      status === "ready_for_turnkey"
        ? "Approved plan is ready for Turnkey policy evaluation and signing."
        : "Plan is not ready for Turnkey signing.",
    pair: simulation.pair,
    feeTier: simulation.feeTier,
    oldRange: simulation.oldRange,
    newRange: simulation.targetRange,
    residual,
    estimatedGas: simulation.estimatedGas,
    estimatedGasUnits: simulation.estimatedGasUnits,
    estimatedGasUsd: simulation.estimatedGasUsd,
    estimatedSlippage: simulation.estimatedSlippage,
    onchainStatus: simulation.onchainStatus,
    approvalReadiness,
    verdict: plan.risk.verdict,
    confidence: plan.risk.confidence,
    reasons: plan.risk.reasons,
    steps: simulation.steps,
    warnings: [...simulation.warnings, ...(policy.allowed ? [] : policy.reasons)],
    policy,
    transaction,
  };
}
