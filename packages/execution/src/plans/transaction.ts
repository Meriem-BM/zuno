import { buildRebalanceCalldata, NFPM_BY_CHAIN as UNISWAP_NFPM } from "@zuno/chain/uniswap";
import type { Address, ChainId, Hex, Plan } from "@zuno/core";
import type { ExecutionTransaction } from "./types.js";
import { applySlippage, parseLiquidity, slippageBps } from "./utils.js";

export const NFPM_BY_CHAIN: Partial<Record<ChainId, Address>> = UNISWAP_NFPM as Partial<
  Record<ChainId, Address>
>;

export function buildExecutionTransaction(
  plan: Plan,
  agentWalletAddress: Address,
): ExecutionTransaction | undefined {
  const chainId = plan.snapshot.position.pool.chainId;
  const to = NFPM_BY_CHAIN[chainId];
  if (!to) return undefined;

  const override = process.env.ZUNO_UNISWAP_REBALANCE_CALLDATA as Hex | undefined;
  if (override && /^0x[a-fA-F0-9]+$/u.test(override)) {
    return { from: agentWalletAddress, to, chainId, data: override, value: "0" };
  }

  const liquidity = parseLiquidity(plan.snapshot.position.liquidity);
  if (!liquidity) return undefined;

  const tx = buildRebalanceCalldata({
    position: plan.snapshot.position,
    liquidity,
    newTickLower: plan.recommended.tickLower,
    newTickUpper: plan.recommended.tickUpper,
    amount0Desired: plan.recommended.deploy0,
    amount1Desired: plan.recommended.deploy1,
    amount0Min: applySlippage(plan.recommended.deploy0, slippageBps(plan)),
    amount1Min: applySlippage(plan.recommended.deploy1, slippageBps(plan)),
    removeAmount0Min: applySlippage(plan.snapshot.position.amount0, slippageBps(plan)),
    removeAmount1Min: applySlippage(plan.snapshot.position.amount1, slippageBps(plan)),
    recipient: agentWalletAddress,
  });

  return {
    from: agentWalletAddress,
    to: tx.to,
    chainId: tx.chainId,
    data: tx.data,
    value: tx.value,
  };
}
