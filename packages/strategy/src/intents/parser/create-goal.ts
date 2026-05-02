import type { CreateGoal, RiskProfile } from "@zuno/core";

/**
 * Goal extraction from free-text input.
 *
 * The deterministic path catches the common phrasings - token + amount,
 * pinned pair, fee tier, risk hint, exposure hint - without an LLM
 * round-trip. The model fallback in `intents/model/prompt.ts` handles
 * the long tail.
 *
 * Whatever this returns is merged with whatever the model emits; non-
 * conflicting fields combine. The clarification flow then asks for
 * load-bearing fields that are still missing.
 */

/**
 * Risk-profile aliases. The regex tolerates a trailing "ly" so that
 * adverbs like "passively" / "actively" map to the same profile as the
 * adjective. Order matters only for which alias gets reported back; we
 * stop at the first match.
 */
const RISK_ALIASES: Record<string, RiskProfile> = {
  conservative: "conservative",
  passive: "conservative",
  safe: "conservative",
  cautious: "conservative",
  defensive: "conservative",
  balanced: "balanced",
  moderate: "balanced",
  neutral: "balanced",
  aggressive: "aggressive",
  active: "aggressive",
  yolo: "aggressive",
  degen: "aggressive",
  spicy: "aggressive",
};

function riskAliasRegex(alias: string): RegExp {
  return new RegExp(`\\b${alias}(?:ly)?\\b`, "iu");
}

const TOKEN_SYMBOLS = ["eth", "weth", "usdc", "usdt", "dai", "wbtc", "btc", "arb", "op", "uni"];
const TOKEN_RE = new RegExp(`\\b(${TOKEN_SYMBOLS.join("|")})\\b`, "iu");
const AMOUNT_TOKEN_RE = new RegExp(
  `(\\d+(?:[.,]\\d+)?)\\s*(${TOKEN_SYMBOLS.join("|")})\\b`,
  "iu",
);
const TOKEN_AMOUNT_RE = new RegExp(
  `(${TOKEN_SYMBOLS.join("|")})\\s+(\\d+(?:[.,]\\d+)?)`,
  "iu",
);
const PAIR_RE = new RegExp(
  `\\b(${TOKEN_SYMBOLS.join("|")})\\s*[/-]\\s*(${TOKEN_SYMBOLS.join("|")})\\b`,
  "iu",
);
const FEE_BPS_RE = /(\d+(?:\.\d+)?)\s*(bps|bp)\b/iu;
const FEE_PCT_RE = /(\d+(?:\.\d+)?)\s*%/u;

/**
 * Parse the free-text "answer" the user gives when we've asked for
 * `which token and how much?`. Accepts any of:
 *   "0.05 ETH", "ETH 0.05", "0.05 in ETH", "0.05 of WETH"
 */
export function parseCreateCapitalAnswer(
  text: string,
): { tokenSymbol: string; amount: string } | null {
  const a = text.match(AMOUNT_TOKEN_RE);
  if (a) return { amount: a[1]!.replace(",", "."), tokenSymbol: a[2]!.toLowerCase() };
  const b = text.match(TOKEN_AMOUNT_RE);
  if (b) return { tokenSymbol: b[1]!.toLowerCase(), amount: b[2]!.replace(",", ".") };
  return null;
}

/**
 * Extract whatever Goal fields we can deterministically from the input.
 *
 * This always returns a partial - the caller decides whether to ask for
 * clarification based on which load-bearing fields are still missing.
 */
export function extractCreateGoal(text: string): Partial<CreateGoal> {
  const lower = text.toLowerCase();
  const goal: Partial<CreateGoal> = {};

  // Capital: amount + token in either order.
  const amtTok = text.match(AMOUNT_TOKEN_RE);
  const tokAmt = text.match(TOKEN_AMOUNT_RE);
  if (amtTok) {
    goal.capital = {
      amount: amtTok[1]!.replace(",", "."),
      tokenSymbol: amtTok[2]!.toLowerCase(),
    };
  } else if (tokAmt) {
    goal.capital = {
      tokenSymbol: tokAmt[1]!.toLowerCase(),
      amount: tokAmt[2]!.replace(",", "."),
    };
  } else {
    // Token only, no amount yet - half a capital, ask later.
    const t = text.match(TOKEN_RE);
    if (t) goal.capital = { tokenSymbol: t[1]!.toLowerCase(), amount: "" };
  }

  // Risk profile aliases. Tolerate adverb suffix ("passively" → passive).
  for (const [alias, profile] of Object.entries(RISK_ALIASES)) {
    if (riskAliasRegex(alias).test(lower)) {
      goal.riskProfile = profile;
      break;
    }
  }

  // Pinned pair like "ETH/USDC" or "ETH-USDC".
  const pair = text.match(PAIR_RE);
  if (pair) {
    goal.pinnedPair = {
      token0Symbol: pair[1]!.toLowerCase(),
      token1Symbol: pair[2]!.toLowerCase(),
    };
  }

  // Pinned fee tier - accept "5bps", "0.05%", "30 bp", "0.3%".
  const bps = text.match(FEE_BPS_RE);
  if (bps) {
    goal.pinnedFeeTier = Math.round(Number.parseFloat(bps[1]!));
  } else {
    const pct = text.match(FEE_PCT_RE);
    if (pct) {
      const v = Number.parseFloat(pct[1]!);
      if (Number.isFinite(v) && v > 0 && v <= 5) {
        goal.pinnedFeeTier = Math.round(v * 10_000); // 0.05% -> 500 bps in v4 fee units
      }
    }
  }

  // Exposure preference. "stay long", "keep my eth", "stay in token" → stay-in-token.
  if (
    /\b(?:stay\s+(?:long|in)|keep\s+my|hold\s+my|long\s+exposure|don'?t\s+sell)\b/iu.test(text)
  ) {
    goal.exposurePreference = "stay-in-token";
  } else if (/\b(?:neutral|balanced|50.?50)\b/iu.test(lower) && goal.riskProfile !== "balanced") {
    goal.exposurePreference = "neutral";
  }

  return goal;
}

// True when the goal has both load-bearing fields filled.
export function hasCreateCapital(goal: Partial<CreateGoal> | undefined): boolean {
  if (!goal?.capital) return false;
  return Boolean(goal.capital.tokenSymbol && goal.capital.amount);
}
