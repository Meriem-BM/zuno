import type { Address, ChainId, Hex, Token } from "@zuno/core";
import {
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  toHex,
} from "viem";
import { POSITION_MANAGER_ABI, POSITION_MANAGER_BY_CHAIN } from "./lib/constants.js";
import { buildPoolKey, liquidityForAmounts } from "../positions/lib/helpers.js";
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
import { publicClient } from "./lib/helpers.js";

export * from "./lib/constants.js";
export * from "./types.js";
export { nfpmFor } from "./lib/helpers.js";

const ACTIONS = {
  INCREASE_LIQUIDITY: 0x00,
  DECREASE_LIQUIDITY: 0x01,
  MINT_POSITION: 0x02,
  BURN_POSITION: 0x03,
  SETTLE_PAIR: 0x0d,
  TAKE_PAIR: 0x11,
} as const;

const HOOK_DATA = "0x" as Hex;

export function buildMint(params: MintParams): PreparedTx {
  const { poolKey } = buildPoolKey(params.token0.address, params.token1.address, params.fee);
  const liquidity = liquidityForAmounts(
    params.amount0Desired,
    params.amount1Desired,
    params.currentTick,
    params.tickLower,
    params.tickUpper,
    params.token0.decimals,
    params.token1.decimals,
  );
  const amount0Max = BigInt(params.amount0Desired || "0");
  const amount1Max = BigInt(params.amount1Desired || "0");
  return buildModifyLiquiditiesTx({
    chainId: params.chainId,
    actions: [ACTIONS.MINT_POSITION, ACTIONS.SETTLE_PAIR],
    params: [
      encodeAbiParameters(
        [
          {
            type: "tuple",
            components: [
              {
                type: "tuple",
                components: [
                  { type: "address" },
                  { type: "address" },
                  { type: "uint24" },
                  { type: "int24" },
                  { type: "address" },
                ],
              },
              { type: "int24" },
              { type: "int24" },
              { type: "uint256" },
              { type: "uint128" },
              { type: "uint128" },
              { type: "address" },
              { type: "bytes" },
            ],
          },
        ],
        [[
          [
            poolKey.currency0,
            poolKey.currency1,
            poolKey.fee,
            poolKey.tickSpacing,
            poolKey.hooks,
          ],
          params.tickLower,
          params.tickUpper,
          liquidity,
          amount0Max,
          amount1Max,
          params.recipient,
          HOOK_DATA,
        ]],
      ),
      encodeAbiParameters(
        [
          {
            type: "tuple",
            components: [
              { type: "address" },
              { type: "address" },
            ],
          },
        ],
        [[poolKey.currency0, poolKey.currency1]],
      ),
    ],
    value: poolKey.currency0 === ZERO_ADDRESS ? params.amount0Desired : "0",
    deadline: params.deadline,
    description: `mint ${params.token0.symbol}/${params.token1.symbol} ${(params.fee / 10_000).toFixed(2)}% [${params.tickLower}..${params.tickUpper}]`,
  });
}

export function buildIncreaseLiquidity(
  params: IncreaseLiquidityParams,
  token0: Token,
  token1: Token,
): PreparedTx {
  return buildModifyLiquiditiesTx({
    chainId: params.chainId,
    actions: [ACTIONS.INCREASE_LIQUIDITY, ACTIONS.SETTLE_PAIR],
    params: [
      encodeAbiParameters(
        [
          {
            type: "tuple",
            components: [
              { type: "uint256" },
              { type: "uint256" },
              { type: "uint128" },
              { type: "uint128" },
              { type: "bytes" },
            ],
          },
        ],
        [
          [
            params.tokenId,
            params.liquidity,
            BigInt(params.amount0Max || "0"),
            BigInt(params.amount1Max || "0"),
            params.hookData ?? HOOK_DATA,
          ],
        ],
      ),
      encodeAbiParameters(
        [{ type: "tuple", components: [{ type: "address" }, { type: "address" }] }],
        [[token0.address, token1.address]],
      ),
    ],
    value: "0",
    description: `add ${token0.symbol}+${token1.symbol} liquidity to position ${params.tokenId}`,
  });
}

export function buildDecreaseLiquidity(params: DecreaseLiquidityParams): PreparedTx {
  return buildModifyLiquiditiesTx({
    chainId: params.chainId,
    actions: [ACTIONS.DECREASE_LIQUIDITY],
    params: [
      encodeAbiParameters(
        [
          {
            type: "tuple",
            components: [
              { type: "uint256" },
              { type: "uint256" },
              { type: "uint128" },
              { type: "uint128" },
              { type: "bytes" },
            ],
          },
        ],
        [[params.tokenId, params.liquidity, BigInt(params.amount0Min || "0"), BigInt(params.amount1Min || "0"), HOOK_DATA]],
      ),
    ],
    value: "0",
    description: `decrease liquidity on position ${params.tokenId}`,
  });
}

export function buildCollect(params: CollectParams): PreparedTx {
  return buildModifyLiquiditiesTx({
    chainId: params.chainId,
    actions: [ACTIONS.DECREASE_LIQUIDITY, ACTIONS.TAKE_PAIR],
    params: [
      encodeAbiParameters(
        [
          {
            type: "tuple",
            components: [
              { type: "uint256" },
              { type: "uint256" },
              { type: "uint128" },
              { type: "uint128" },
              { type: "bytes" },
            ],
          },
        ],
        [[params.tokenId, 0n, 0n, 0n, HOOK_DATA]],
      ),
      encodeAbiParameters(
        [
          {
            type: "tuple",
            components: [
              { type: "address" },
              { type: "address" },
              { type: "address" },
            ],
          },
        ],
        [[params.token0, params.token1, params.recipient]],
      ),
    ],
    value: "0",
    description: `collect fees on position ${params.tokenId}`,
  });
}

export function buildBurn(params: BurnParams): PreparedTx {
  return buildModifyLiquiditiesTx({
    chainId: params.chainId,
    actions: [ACTIONS.BURN_POSITION],
    params: [
      encodeAbiParameters(
        [
          {
            type: "tuple",
            components: [
              { type: "uint256" },
              { type: "uint128" },
              { type: "uint128" },
              { type: "bytes" },
            ],
          },
        ],
        [
          [
            params.tokenId,
            BigInt(params.amount0Min || "0"),
            BigInt(params.amount1Min || "0"),
            params.hookData ?? HOOK_DATA,
          ],
        ],
      ),
    ],
    value: "0",
    description: `burn position NFT ${params.tokenId}`,
  });
}

export function buildRebalanceCalldata(input: RebalanceCalldataInput): PreparedTx {
  const chainId = input.position.pool.chainId;
  const tokenId = BigInt(input.position.id);
  const deadline = Math.floor(Date.now() / 1000) + Math.max(60, input.deadlineSeconds ?? 20 * 60);
  const { poolKey } = buildPoolKey(
    input.position.pool.token0.address,
    input.position.pool.token1.address,
    input.position.pool.feeTier,
  );
  const liquidity = liquidityForAmounts(
    input.amount0Desired,
    input.amount1Desired,
    input.position.pool.currentTick,
    input.newTickLower,
    input.newTickUpper,
    input.position.pool.token0.decimals,
    input.position.pool.token1.decimals,
  );

  const actions = [ACTIONS.BURN_POSITION, ACTIONS.MINT_POSITION, ACTIONS.SETTLE_PAIR];
  const params = [
    encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { type: "uint256" },
            { type: "uint128" },
            { type: "uint128" },
            { type: "bytes" },
          ],
        },
      ],
      [[tokenId, BigInt(input.removeAmount0Min || "0"), BigInt(input.removeAmount1Min || "0"), HOOK_DATA]],
    ),
    encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            {
              type: "tuple",
              components: [
                { type: "address" },
                { type: "address" },
                { type: "uint24" },
                { type: "int24" },
                { type: "address" },
              ],
            },
            { type: "int24" },
            { type: "int24" },
            { type: "uint256" },
            { type: "uint128" },
            { type: "uint128" },
            { type: "address" },
            { type: "bytes" },
          ],
        },
      ],
      [[
        [
          poolKey.currency0,
          poolKey.currency1,
          poolKey.fee,
          poolKey.tickSpacing,
          poolKey.hooks,
        ],
        input.newTickLower,
        input.newTickUpper,
        liquidity,
        BigInt(input.amount0Desired || "0"),
        BigInt(input.amount1Desired || "0"),
        input.recipient,
        HOOK_DATA,
      ]],
    ),
    encodeAbiParameters(
      [{ type: "tuple", components: [{ type: "address" }, { type: "address" }] }],
      [[poolKey.currency0, poolKey.currency1]],
    ),
  ];

  return buildModifyLiquiditiesTx({
    chainId,
    actions,
    params,
    value: poolKey.currency0 === ZERO_ADDRESS ? input.amount0Desired : "0",
    deadline,
    description: `rebalance ${input.position.id}: burn → mint [${input.newTickLower}..${input.newTickUpper}]`,
  });
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

function buildModifyLiquiditiesTx(input: {
  chainId: ChainId;
  actions: readonly number[];
  params: readonly Hex[];
  description: string;
  value?: string;
  deadline?: number;
}): PreparedTx {
  const to = positionManagerFor(input.chainId);
  const actionBytes = concatHex(input.actions.map((action) => toHex(action, { size: 1 })));
  const unlockData = encodeAbiParameters(
    [
      { type: "bytes" },
      { type: "bytes[]" },
    ],
    [actionBytes, input.params],
  );
  const data = encodeFunctionData({
    abi: POSITION_MANAGER_ABI,
    functionName: "modifyLiquidities",
    args: [unlockData, BigInt(input.deadline ?? Math.floor(Date.now() / 1000) + 20 * 60)],
  });
  return {
    chainId: input.chainId,
    to,
    data,
    value: input.value ?? "0",
    description: input.description,
  };
}

function positionManagerFor(chainId: ChainId): Address {
  const to = POSITION_MANAGER_BY_CHAIN[chainId];
  if (!to) throw new Error(`Uniswap v4 position manager not configured for chain ${chainId}`);
  return to;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
