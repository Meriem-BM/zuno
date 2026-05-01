import {
  ADDRESS_PATTERN,
  AMOUNT_TOKEN_PATTERN,
  PLAN_PATTERNS,
  POSITION_PATTERNS,
} from "./rules.js";
import type { Entities } from "../contracts/types.js";

export function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[?!.]+$/u, "")
    .replace(/\s+/gu, " ");
}

export function extractEntities(text: string): Entities {
  const out: Entities = {};

  const positionId = firstCapture(text, POSITION_PATTERNS);
  if (positionId) out.positionId = positionId;

  const planId = firstCapture(text, PLAN_PATTERNS);
  if (planId) out.planId = planId;

  const addr = text.match(ADDRESS_PATTERN);
  if (addr) out.walletAddress = addr[1]!.toLowerCase();

  const amt = text.match(AMOUNT_TOKEN_PATTERN);
  if (amt) {
    out.amount = amt[1]!;
    out.tokenSymbol = amt[2]!.toLowerCase();
  }

  const swapPair = text.match(
    /\b(eth|weth|usdc|usdt|dai|wbtc)\b\s+(?:to|for|into)\s+\b(eth|weth|usdc|usdt|dai|wbtc)\b/iu,
  );
  if (swapPair) {
    out.tokenSymbol = swapPair[1]!.toLowerCase();
    out.tokenOutSymbol = swapPair[2]!.toLowerCase();
  }

  const chain = text.match(/\b(mainnet|ethereum|optimism|base|arbitrum)\b/iu);
  if (chain) out.chainName = chain[1]!.toLowerCase();

  return out;
}

function firstCapture(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1];
  }
  return undefined;
}
