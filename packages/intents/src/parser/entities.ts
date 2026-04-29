import {
  ADDRESS_PATTERN,
  AMOUNT_TOKEN_PATTERN,
  PLAN_PATTERNS,
  POSITION_PATTERNS,
  SIGNER_PATTERNS,
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

  for (const { signer, test } of SIGNER_PATTERNS) {
    if (test.test(text)) {
      out.signerMode = signer;
      break;
    }
  }
  return out;
}

function firstCapture(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1];
  }
  return undefined;
}
