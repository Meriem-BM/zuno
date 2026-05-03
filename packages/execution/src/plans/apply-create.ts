import { chainConfig, viemChainFor } from "@zuno/chain/config";
import { checkApprovalRequirement, checkPermit2ApprovalRequirement } from "@zuno/chain/tokens";
import type { Address, ChainId, Token } from "@zuno/core";
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import type { ApprovalReadiness, CreateApplyReadiness } from "./types.js";
import { errorMessage } from "./utils.js";

const ZERO = "0x0000000000000000000000000000000000000000";

interface CreateAction {
  summary: {
    chainId: ChainId;
    pool: { token0: Token; token1: Token };
    amount0Max: string;
    amount1Max: string;
  };
}

export async function prepareCreateApply(
  action: CreateAction,
  owner: Address,
): Promise<CreateApplyReadiness> {
  const { summary } = action;
  const chainId = summary.chainId;
  const cfg = chainConfig(chainId);
  const permit2 = cfg.permit2;
  const positionManager = cfg.positionManager;
  const items = [
    { token: summary.pool.token0, requiredWei: safeBigInt(summary.amount0Max) },
    { token: summary.pool.token1, requiredWei: safeBigInt(summary.amount1Max) },
  ].filter((i) => i.requiredWei > 0n);

  const client = createPublicClient({
    chain: viemChainFor(chainId),
    transport: http(chainConfig(chainId).rpcUrl),
  });

  const warnings: string[] = [];
  const readiness: ApprovalReadiness[] = [];

  for (const item of items) {
    if (item.token.address.toLowerCase() === ZERO) {
      const balance = await client.getBalance({ address: owner }).catch(() => 0n);
      const sufficient = balance >= item.requiredWei;
      if (!sufficient) {
        warnings.push(
          `Insufficient ETH: have ${formatUnits(balance, item.token.decimals)}, need ${formatUnits(item.requiredWei, item.token.decimals)}.`,
        );
      }
      readiness.push({
        tokenSymbol: item.token.symbol,
        requiredWei: item.requiredWei.toString(),
        sufficient,
      });
      continue;
    }

    try {
      const balance = (await client.readContract({
        address: item.token.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
      })) as bigint;
      const balanceOk = balance >= item.requiredWei;
      if (!balanceOk) {
        warnings.push(
          `Insufficient ${item.token.symbol}: have ${formatUnits(balance, item.token.decimals)}, need ${formatUnits(item.requiredWei, item.token.decimals)}.`,
        );
      }
      const reading = await checkApprovalRequirement(
        { token: item.token, owner, spender: permit2, chainId },
        item.requiredWei,
      );
      if (reading.needsApproval) {
        warnings.push(`Approve ${item.token.symbol} for Permit2 before applying.`);
      }
      const permit2Reading = await checkPermit2ApprovalRequirement(
        { token: item.token, owner, spender: positionManager, chainId },
        item.requiredWei,
      );
      if (permit2Reading.needsApproval) {
        warnings.push(
          `Grant Permit2 ${item.token.symbol} spending to the Uniswap v4 PositionManager before applying. Try "approve permit2 ${item.token.symbol}".`,
        );
      }
      readiness.push({
        tokenSymbol: item.token.symbol,
        requiredWei: item.requiredWei.toString(),
        currentAllowanceWei: reading.currentAllowanceWei,
        sufficient: balanceOk && !reading.needsApproval && !permit2Reading.needsApproval,
        reason: permit2Reading.needsApproval
          ? "Permit2 spender approval is required for the Uniswap v4 PositionManager."
          : reading.needsApproval
            ? "ERC20 approval to Permit2 is required."
            : undefined,
      });
    } catch (e) {
      warnings.push(`Could not verify ${item.token.symbol}: ${errorMessage(e)}`);
      readiness.push({
        tokenSymbol: item.token.symbol,
        requiredWei: item.requiredWei.toString(),
        sufficient: false,
      });
    }
  }

  return {
    status: warnings.length === 0 ? "ready" : "blocked",
    warnings,
    readiness,
  };
}

function safeBigInt(value: string | undefined): bigint {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}
