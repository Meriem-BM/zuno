import { chainConfig, chainName } from "@zuno/chain/config";
import {
  buildApproveTransaction,
  lookupToken,
  MAX_UINT256,
  readAllowances,
} from "@zuno/chain/tokens";
import { checkApproval, tradingApiEnabled } from "@zuno/chain/uniswap/trading-api";
import { newPreparedActionId } from "@zuno/core";
import { listPositions } from "@zuno/chain/uniswap";
import { encodeFunctionData, parseUnits } from "viem";
import type { Address, ChainId, Token } from "@zuno/core";
import type {
  ApproveTokenSummary,
  NeedsConfirmationData,
  ShowAllowancesData,
  ToolDefinition,
} from "../../contracts/types.js";
import {
  err,
  missingAgentWallet,
  needsConfirmation,
  ok,
  preparedActionStore,
  resolveAgentWallet,
} from "../shared.js";

const APPROVE_EXPIRY_MS = 10 * 60 * 1000;

const showAllowances: ToolDefinition = {
  name: "showAllowances",
  intents: ["show_allowances"],
  execute: async (_, ctx) => {
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("showAllowances");

    const spender = chainConfig(target.chainId).permit2;

    try {
      const positions = await listPositions(target.address, { chainId: target.chainId });
      const tokens = uniqueTokens(positions.flatMap((p) => [p.pool.token0, p.pool.token1]));
      if (tokens.length === 0) {
        return ok("showAllowances", "No LP tokens to check yet.", {
          agentWalletAddress: target.address,
          chainId: target.chainId,
          chainName: chainName(target.chainId),
          spender,
          spenderLabel: "Uniswap v4 Permit2",
          allowances: [],
        } satisfies ShowAllowancesData);
      }

      const readings = await readAllowances(
        tokens.map((t) => ({
          token: t,
          owner: target.address,
          spender,
          chainId: target.chainId,
        })),
      );

      const data: ShowAllowancesData = {
        agentWalletAddress: target.address,
        chainId: target.chainId,
        chainName: chainName(target.chainId),
        spender,
        spenderLabel: "Uniswap v4 Permit2",
        allowances: readings.map((r) => ({
          token: {
            address: r.token.address,
            symbol: r.token.symbol,
            decimals: r.token.decimals,
          },
          allowance: r.allowance,
          sufficient: r.sufficient,
        })),
      };
      return ok("showAllowances", `${readings.length} allowance(s) checked.`, data);
    } catch (error) {
      return err(
        "showAllowances",
        "CHAIN_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  },
};

const approveToken: ToolDefinition = {
  name: "approveToken",
  intents: ["approve_token"],
  execute: async (intent, ctx) => {
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("approveToken");

    const symbol = intent.tokenSymbol;
    if (!symbol) {
      return err(
        "approveToken",
        "TOKEN_UNKNOWN",
        'Which token should I approve? Try "approve USDC".',
      );
    }
    const token = lookupToken(symbol, target.chainId);
    if (!token) {
      return err(
        "approveToken",
        "TOKEN_UNKNOWN",
        `${symbol.toUpperCase()} is not a known token on ${chainName(target.chainId)}.`,
      );
    }
    const spender = chainConfig(target.chainId).permit2;

    const amountWei = intent.amount ? parseUnits(intent.amount, token.decimals) : MAX_UINT256;
    const summary: ApproveTokenSummary = {
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      spenderLabel: "Uniswap v4 Permit2",
      spenderAddress: spender,
      amount: intent.amount ?? "unlimited",
      chainId: target.chainId,
      chainName: chainName(target.chainId),
    };

    let approvalTx: {
      chainId: ChainId;
      from?: Address;
      to: Address;
      data: `0x${string}`;
      value: string;
      description: string;
    } = buildApproveTransaction(token, spender, amountWei, target.chainId);
    if (tradingApiEnabled()) {
      try {
        const approval = await checkApproval({
          walletAddress: target.address,
          token: token.address,
          amount: amountWei.toString(),
          chainId: target.chainId,
        });
        if (approval.cancel) {
          return err(
            "approveToken",
            "APPROVAL_REQUIRED",
            "This token needs an allowance reset before it can be approved again. Revoke the old allowance first, then retry.",
          );
        }
        if (approval.approval) {
          approvalTx = {
            chainId: approval.approval.chainId,
            from: approval.approval.from as Address,
            to: approval.approval.to,
            data: approval.approval.data,
            value: approval.approval.value,
            description: `approve ${summary.amount} ${summary.tokenSymbol} for ${summary.spenderLabel}`,
          };
        } else {
          return ok(
            "approveToken",
            `${summary.tokenSymbol} is already approved for ${summary.spenderLabel}.`,
            summary,
          );
        }
      } catch (error) {
        return err(
          "approveToken",
          "CHAIN_READ_FAILED",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    const id = newPreparedActionId();
    const now = Date.now();
    const expiresAt = now + APPROVE_EXPIRY_MS;
    const transactions = [
      {
        chainId: approvalTx.chainId,
        from: approvalTx.from,
        to: approvalTx.to,
        data: approvalTx.data,
        value: approvalTx.value,
        description: approvalTx.description,
      },
    ];
    await preparedActionStore(ctx).save({
      id,
      kind: "approve",
      summary,
      transactions,
      state: "pending_review",
      createdAt: now,
      expiresAt,
      ownerAddress: target.address,
      chainId: target.chainId,
    });
    const data: NeedsConfirmationData<ApproveTokenSummary> = {
      preparedAction: { id, kind: "approve", summary, transactions, expiresAt },
      prompt: `Approve ${summary.amount} ${summary.tokenSymbol} for ${summary.spenderLabel}? Type "approve it" to confirm.`,
    };
    return needsConfirmation<ApproveTokenSummary>(
      "approveToken",
      `Prepared approve ${summary.amount} ${summary.tokenSymbol}.`,
      data,
    );
  },
};

const PERMIT2_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
] as const;

const MAX_UINT160 = (1n << 160n) - 1n;
const MAX_UINT48 = (1n << 48n) - 1n;

const approvePermit2Spender: ToolDefinition = {
  name: "approvePermit2Spender",
  intents: ["approve_permit2_spender"],
  execute: async (intent, ctx) => {
    const target = resolveAgentWallet(ctx);
    if (!target) return missingAgentWallet("approvePermit2Spender");

    const symbol = intent.tokenSymbol;
    if (!symbol) {
      return err(
        "approvePermit2Spender",
        "TOKEN_UNKNOWN",
        'Which token? Try "approve permit2 USDC".',
      );
    }
    const token = lookupToken(symbol, target.chainId);
    if (!token) {
      return err(
        "approvePermit2Spender",
        "TOKEN_UNKNOWN",
        `${symbol.toUpperCase()} is not a known token on ${chainName(target.chainId)}.`,
      );
    }

    const cfg = chainConfig(target.chainId);
    const permit2 = cfg.permit2;
    const posManager = cfg.positionManager;
    const data = encodeFunctionData({
      abi: PERMIT2_APPROVE_ABI,
      functionName: "approve",
      args: [token.address, posManager, MAX_UINT160, Number(MAX_UINT48)],
    });

    const summary: ApproveTokenSummary = {
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      spenderLabel: "Uniswap v4 PositionManager (via Permit2)",
      spenderAddress: posManager,
      amount: "unlimited",
      chainId: target.chainId,
      chainName: chainName(target.chainId),
    };

    const id = newPreparedActionId();
    const now = Date.now();
    const expiresAt = now + APPROVE_EXPIRY_MS;
    const transactions = [
      {
        chainId: target.chainId,
        from: target.address,
        to: permit2,
        data,
        value: "0",
        description: `permit2.approve(${token.symbol}, posManager, max, max)`,
      },
    ];
    await preparedActionStore(ctx).save({
      id,
      kind: "approve",
      summary,
      transactions,
      state: "pending_review",
      createdAt: now,
      expiresAt,
      ownerAddress: target.address,
      chainId: target.chainId,
    });
    const responseData: NeedsConfirmationData<ApproveTokenSummary> = {
      preparedAction: { id, kind: "approve", summary, transactions, expiresAt },
      prompt: `Grant Permit2 the right to spend your ${token.symbol} via the v4 PositionManager? Type "approve it" to confirm.`,
    };
    return needsConfirmation<ApproveTokenSummary>(
      "approvePermit2Spender",
      `Prepared Permit2 approval of ${token.symbol} for the v4 PositionManager.`,
      responseData,
    );
  },
};

function uniqueTokens(tokens: Token[]): Token[] {
  const seen = new Set<string>();
  const out: Token[] = [];
  for (const t of tokens) {
    const key = t.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export const APPROVAL_TOOLS: readonly ToolDefinition[] = [
  showAllowances,
  approveToken,
  approvePermit2Spender,
];
