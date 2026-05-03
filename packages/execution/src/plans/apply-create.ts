import { chainConfig, viemChainFor } from "@zuno/chain/config";
import { checkApprovalRequirement } from "@zuno/chain/tokens";
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

// Pre-apply readiness for create-position: balance check (native + ERC20)
// plus Permit2 allowance check for ERC20 deposits. Mirrors the rebalance gate.
export async function prepareCreateApply(
  action: CreateAction,
  owner: Address,
): Promise<CreateApplyReadiness> {
  const { summary } = action;
  const chainId = summary.chainId;
  const spender = chainConfig(chainId).permit2;
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
        { token: item.token, owner, spender, chainId },
        item.requiredWei,
      );
      if (reading.needsApproval) {
        warnings.push(`Approve ${item.token.symbol} for Permit2 before applying.`);
      }
      readiness.push({
        tokenSymbol: item.token.symbol,
        requiredWei: item.requiredWei.toString(),
        currentAllowanceWei: reading.currentAllowanceWei,
        sufficient: balanceOk && !reading.needsApproval,
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
