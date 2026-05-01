import { fetchBalances } from "@zuno/chain/tokens";
import { chainName } from "@zuno/chain/config";
import { listPositions } from "@zuno/chain/uniswap";
import type { Token } from "@zuno/core";
import type { ShowBalancesData, ToolDefinition } from "../../contracts/types.js";
import { err, missingAgentWallet, ok, resolveAgentWallet } from "../shared.js";

const showBalances: ToolDefinition = {
  name: "showBalances",
  intents: ["show_balances"],
  execute: async (_, ctx) => {
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("showBalances");
    try {
      const positions = await listPositions(target.address, { chainId: target.chainId });
      const extras: Token[] = [];
      for (const p of positions) {
        extras.push(p.pool.token0, p.pool.token1);
      }
      const snap = await fetchBalances(target.address, target.chainId, { extraTokens: extras });
      const data: ShowBalancesData = {
        agentWalletAddress: snap.address,
        chainId: snap.chainId,
        chainName: snap.chainName,
        native: snap.native,
        tokens: snap.tokens.map((t) => ({
          symbol: t.token.symbol,
          amount: t.amount,
          address: t.token.address,
          decimals: t.token.decimals,
        })),
      };
      return ok(
        "showBalances",
        `${snap.tokens.length + 1} balances on ${chainName(target.chainId)}.`,
        data,
      );
    } catch (error) {
      return err(
        "showBalances",
        "CHAIN_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  },
};

export const BALANCE_TOOLS: readonly ToolDefinition[] = [showBalances];
