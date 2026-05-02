import type { Address, ChainId, Hex, Token } from "@zuno/core";

const DEFAULT_BASE_URL = "https://trade-api.gateway.uniswap.org/v1";
const UNIVERSAL_ROUTER_VERSION = "2.0";
const DEFAULT_PROTOCOLS = ["V2", "V3", "V4"] as const;

export interface TradingApiConfig {
  baseUrl: string;
  apiKey: string;
}

export interface TradingApiTx {
  to: Address;
  from: Address;
  data: Hex;
  value: string;
  chainId: ChainId;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
}

export interface TradingApiApprovalCheck {
  approval: TradingApiTx | null;
  cancel: TradingApiTx | null;
  gasFee?: string;
}

export interface TradingApiQuoteRequest {
  swapper: Address;
  tokenIn: Token;
  tokenOut: Token;
  amount: string;
  chainId: ChainId;
  slippageTolerance?: number;
  routingPreference?: "BEST_PRICE" | "FASTEST";
  protocols?: readonly ("V2" | "V3" | "V4" | "UNISWAPX_V2" | "UNISWAPX_V3")[];
  permit2Enabled?: boolean;
}

export interface TradingApiQuoteResult {
  requestId: string;
  routing: string;
  quote: Record<string, unknown>;
  permitData?: unknown;
  permitTransaction?: TradingApiTx;
  permitGasFee?: string;
  gasFee?: string;
}

export interface TradingApiSwapResult {
  requestId: string;
  swap: TradingApiTx;
  gasFee?: string;
}

export function tradingApiConfig(): TradingApiConfig | null {
  const apiKey = process.env.ZUNO_UNISWAP_TRADING_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.ZUNO_UNISWAP_TRADING_API_BASE_URL?.trim() || DEFAULT_BASE_URL,
  };
}

export function tradingApiEnabled(): boolean {
  return Boolean(tradingApiConfig());
}

export async function checkApproval(
  input: {
    walletAddress: Address;
    token: Address;
    amount: string;
    chainId: ChainId;
  },
  config = tradingApiConfig(),
): Promise<TradingApiApprovalCheck> {
  const response = await postJson<{
    approval?: TradingApiTx | null;
    cancel?: TradingApiTx | null;
    gasFee?: string;
  }>(
    config,
    "/check_approval",
    {
      walletAddress: input.walletAddress,
      token: input.token,
      amount: input.amount,
      chainId: input.chainId,
    },
    {
      "Content-Type": "application/json",
    },
  );

  return {
    approval: response.approval ?? null,
    cancel: response.cancel ?? null,
    gasFee: response.gasFee,
  };
}

export async function quoteSwap(
  input: TradingApiQuoteRequest,
  config = tradingApiConfig(),
): Promise<TradingApiQuoteResult> {
  const response = await postJson<TradingApiQuoteResult>(
    config,
    "/quote",
    {
      swapper: input.swapper,
      tokenIn: input.tokenIn.address,
      tokenOut: input.tokenOut.address,
      tokenInChainId: String(input.chainId),
      tokenOutChainId: String(input.chainId),
      amount: input.amount,
      type: "EXACT_INPUT",
      slippageTolerance: input.slippageTolerance ?? 0.5,
      routingPreference: input.routingPreference ?? "BEST_PRICE",
      protocols: input.protocols ?? DEFAULT_PROTOCOLS,
    },
    {
      "Content-Type": "application/json",
      "x-universal-router-version": UNIVERSAL_ROUTER_VERSION,
      "x-permit2-enabled": String(input.permit2Enabled ?? false),
    },
  );
  return response;
}

export async function buildSwap(
  quote: TradingApiQuoteResult,
  config = tradingApiConfig(),
): Promise<TradingApiSwapResult> {
  const response = await postJson<TradingApiSwapResult>(
    config,
    "/swap",
    {
      quote: quote.quote,
      permitData: quote.permitData,
      refreshGasPrice: true,
      simulateTransaction: false,
      safetyMode: "SAFE",
      urgency: "normal",
    },
    {
      "Content-Type": "application/json",
      "x-universal-router-version": UNIVERSAL_ROUTER_VERSION,
    },
  );
  return response;
}

export function requireTradingApiConfig(): TradingApiConfig {
  const config = tradingApiConfig();
  if (!config) {
    throw new Error(
      "Set ZUNO_UNISWAP_TRADING_API_KEY to enable the Uniswap Trading API swap flow.",
    );
  }
  return config;
}

async function postJson<T>(
  config: TradingApiConfig | null,
  path: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  if (!config) {
    throw new Error(
      "Set ZUNO_UNISWAP_TRADING_API_KEY to enable the Uniswap Trading API swap flow.",
    );
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      ...extraHeaders,
      "x-api-key": config.apiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(formatError(response.status, text));
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

function formatError(status: number, body: string): string {
  if (!body) return `Uniswap Trading API request failed with HTTP ${status}`;
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string; detail?: string };
    return parsed.message ?? parsed.error ?? parsed.detail ?? `Uniswap Trading API HTTP ${status}`;
  } catch {
    return `Uniswap Trading API HTTP ${status}: ${body}`;
  }
}
