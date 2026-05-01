import type { Address, ChainId } from "@zuno/core";
import { encodeFunctionData } from "viem";
import { MAX_UINT128, NFPM_ABI } from "./lib/constants.js";
import { nfpmFor, publicClient } from "./lib/helpers.js";
import type {
  BurnParams,
  CollectParams,
  DecreaseLiquidityParams,
  IncreaseLiquidityParams,
  MintParams,
  PreparedTx,
  RebalanceCalldataInput,
  TransactionSimulation,
} from "./types.js";
import type { Token } from "@zuno/core";

export * from "./lib/constants.js";
export * from "./types.js";
export { nfpmFor } from "./lib/helpers.js";

export function buildMint(params: MintParams): PreparedTx {
  const to = nfpmFor(params.chainId);
  const data = encodeFunctionData({
    abi: NFPM_ABI,
    functionName: "mint",
    args: [
      {
        token0: params.token0.address,
        token1: params.token1.address,
        fee: params.fee,
        tickLower: params.tickLower,
        tickUpper: params.tickUpper,
        amount0Desired: BigInt(params.amount0Desired),
        amount1Desired: BigInt(params.amount1Desired),
        amount0Min: BigInt(params.amount0Min),
        amount1Min: BigInt(params.amount1Min),
        recipient: params.recipient,
        deadline: BigInt(params.deadline),
      },
    ],
  });
  return {
    chainId: params.chainId,
    to,
    data,
    value: "0",
    description: `mint ${params.token0.symbol}/${params.token1.symbol} ${(params.fee / 10_000).toFixed(2)}% [${params.tickLower}..${params.tickUpper}]`,
  };
}

export function buildIncreaseLiquidity(
  params: IncreaseLiquidityParams,
  token0: Token,
  token1: Token,
): PreparedTx {
  const to = nfpmFor(params.chainId);
  const data = encodeFunctionData({
    abi: NFPM_ABI,
    functionName: "increaseLiquidity",
    args: [
      {
        tokenId: params.tokenId,
        amount0Desired: BigInt(params.amount0Desired),
        amount1Desired: BigInt(params.amount1Desired),
        amount0Min: BigInt(params.amount0Min),
        amount1Min: BigInt(params.amount1Min),
        deadline: BigInt(params.deadline),
      },
    ],
  });
  return {
    chainId: params.chainId,
    to,
    data,
    value: "0",
    description: `add ${token0.symbol}+${token1.symbol} liquidity to position ${params.tokenId}`,
  };
}

export function buildDecreaseLiquidity(params: DecreaseLiquidityParams): PreparedTx {
  const to = nfpmFor(params.chainId);
  const data = encodeFunctionData({
    abi: NFPM_ABI,
    functionName: "decreaseLiquidity",
    args: [
      {
        tokenId: params.tokenId,
        liquidity: params.liquidity,
        amount0Min: BigInt(params.amount0Min),
        amount1Min: BigInt(params.amount1Min),
        deadline: BigInt(params.deadline),
      },
    ],
  });
  return {
    chainId: params.chainId,
    to,
    data,
    value: "0",
    description: `decrease liquidity on position ${params.tokenId}`,
  };
}

export function buildCollect(params: CollectParams): PreparedTx {
  const to = nfpmFor(params.chainId);
  const data = encodeFunctionData({
    abi: NFPM_ABI,
    functionName: "collect",
    args: [
      {
        tokenId: params.tokenId,
        recipient: params.recipient,
        amount0Max: BigInt(params.amount0Max || MAX_UINT128.toString()),
        amount1Max: BigInt(params.amount1Max || MAX_UINT128.toString()),
      },
    ],
  });
  return {
    chainId: params.chainId,
    to,
    data,
    value: "0",
    description: `collect fees on position ${params.tokenId}`,
  };
}

export function buildBurn(params: BurnParams): PreparedTx {
  const to = nfpmFor(params.chainId);
  const data = encodeFunctionData({
    abi: NFPM_ABI,
    functionName: "burn",
    args: [params.tokenId],
  });
  return {
    chainId: params.chainId,
    to,
    data,
    value: "0",
    description: `burn position NFT ${params.tokenId}`,
  };
}

export function packMulticall(calls: PreparedTx[], chainId: ChainId, label: string): PreparedTx {
  if (calls.length === 0) throw new Error("multicall requires at least one inner call");
  const to = nfpmFor(chainId);
  const data = encodeFunctionData({
    abi: NFPM_ABI,
    functionName: "multicall",
    args: [calls.map((c) => c.data)],
  });
  return { chainId, to, data, value: "0", description: label };
}

export function buildRebalanceCalldata(input: RebalanceCalldataInput): PreparedTx {
  const chainId = input.position.pool.chainId;
  const tokenId = BigInt(input.position.id);
  const deadline = Math.floor(Date.now() / 1000) + Math.max(60, input.deadlineSeconds ?? 20 * 60);

  const calls: PreparedTx[] = [
    buildDecreaseLiquidity({
      tokenId,
      liquidity: input.liquidity,
      amount0Min: input.removeAmount0Min ?? "0",
      amount1Min: input.removeAmount1Min ?? "0",
      deadline,
      chainId,
    }),
    buildCollect({
      tokenId,
      recipient: input.recipient,
      amount0Max: MAX_UINT128.toString(),
      amount1Max: MAX_UINT128.toString(),
      chainId,
    }),
    buildBurn({ tokenId, chainId }),
    buildMint({
      token0: input.position.pool.token0,
      token1: input.position.pool.token1,
      fee: input.position.pool.feeTier,
      tickLower: input.newTickLower,
      tickUpper: input.newTickUpper,
      amount0Desired: input.amount0Desired,
      amount1Desired: input.amount1Desired,
      amount0Min: input.amount0Min,
      amount1Min: input.amount1Min,
      recipient: input.recipient,
      deadline,
      chainId,
    }),
  ];

  return packMulticall(
    calls,
    chainId,
    `rebalance ${input.position.id}: decrease → collect → burn → mint [${input.newTickLower}..${input.newTickUpper}]`,
  );
}

export async function simulatePreparedTransaction(
  tx: PreparedTx,
  from: Address,
): Promise<TransactionSimulation> {
  try {
    const client = publicClient(tx.chainId);
    const gas = await client.estimateGas({
      account: from,
      to: tx.to,
      data: tx.data,
      value: BigInt(tx.value || "0"),
    });
    return { ok: true, gasUnits: gas.toString() };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
