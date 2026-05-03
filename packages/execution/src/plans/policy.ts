import { chainConfig } from "@zuno/chain/config";
import { checkApprovalRequirement, checkPermit2ApprovalRequirement } from "@zuno/chain/tokens";
import type { Address, Plan } from "@zuno/core";
import { POSITION_MANAGER_BY_CHAIN } from "./transaction.js";
import type {
  ApprovalReadiness,
  ExecutionTransaction,
  PlanSimulation,
  PolicyCheck,
} from "./types.js";
import { errorMessage, hasShortfall, safeBigInt } from "./utils.js";

export function checkExecutionPolicy(
  plan: Plan,
  transaction: ExecutionTransaction | undefined,
  simulation: PlanSimulation,
  approvals: ApprovalReadiness[],
): PolicyCheck {
  const reasons: string[] = [];
  if (plan.risk.verdict === "reject") reasons.push("Risk agent rejected this plan.");
  if (hasShortfall(plan)) {
    reasons.push(plan.recommended.prepAction ?? "Inventory prep is required before execution.");
  }
  if (simulation.onchainStatus === "failed") {
    reasons.push(`Onchain simulation failed: ${simulation.revertReason ?? "unknown revert"}`);
  }
  for (const approval of approvals) {
    if (!approval.sufficient) {
      reasons.push(approval.reason ?? `${approval.tokenSymbol} approval is required.`);
    }
  }
  if (!transaction) {
    reasons.push("Could not build deterministic rebalance calldata for this plan.");
  } else {
    const allowedTo = POSITION_MANAGER_BY_CHAIN[transaction.chainId];
    if (transaction.to.toLowerCase() !== allowedTo?.toLowerCase()) {
      reasons.push("Transaction target is not the allowlisted Uniswap position manager.");
    }
    if (transaction.value && BigInt(transaction.value) > 0n) {
      reasons.push("Native value transfer is not allowed for LP rebalance execution.");
    }
  }
  return { allowed: reasons.length === 0, reasons };
}

export async function checkApprovals(plan: Plan, owner: Address): Promise<ApprovalReadiness[]> {
  const chainId = plan.snapshot.position.pool.chainId;
  const cfg = chainConfig(chainId);
  const permit2 = cfg.permit2;
  const positionManager = cfg.positionManager;

  const tokens = [
    {
      token: plan.snapshot.position.pool.token0,
      requiredWei: safeBigInt(plan.recommended.deploy0),
    },
    {
      token: plan.snapshot.position.pool.token1,
      requiredWei: safeBigInt(plan.recommended.deploy1),
    },
  ].filter((item) => item.requiredWei > 0n);

  const results: ApprovalReadiness[] = [];
  for (const item of tokens) {
    if (item.token.address === "0x0000000000000000000000000000000000000000") {
      results.push({
        tokenSymbol: item.token.symbol,
        requiredWei: item.requiredWei.toString(),
        sufficient: true,
      });
      continue;
    }
    try {
      const reading = await checkApprovalRequirement(
        { token: item.token, owner, spender: permit2, chainId },
        item.requiredWei,
      );
      const permit2Reading = await checkPermit2ApprovalRequirement(
        { token: item.token, owner, spender: positionManager, chainId },
        item.requiredWei,
      );
      results.push({
        tokenSymbol: item.token.symbol,
        requiredWei: item.requiredWei.toString(),
        currentAllowanceWei: reading.currentAllowanceWei,
        sufficient: !reading.needsApproval && !permit2Reading.needsApproval,
        reason: permit2Reading.needsApproval
          ? `Grant Permit2 ${item.token.symbol} spending to the Uniswap v4 PositionManager before applying. Try "approve permit2 ${item.token.symbol}".`
          : reading.needsApproval
            ? `Approve ${item.token.symbol} for Permit2 before applying.`
            : undefined,
      });
    } catch (error) {
      results.push({
        tokenSymbol: item.token.symbol,
        requiredWei: item.requiredWei.toString(),
        sufficient: false,
        reason: `Could not verify ${item.token.symbol} allowance: ${errorMessage(error)}`,
      });
    }
  }
  return results;
}
