import type { CreateGoal, RiskProfile } from "@zuno/core";

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
const AMOUNT_TOKEN_RE = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${TOKEN_SYMBOLS.join("|")})\\b`, "iu");
const TOKEN_AMOUNT_RE = new RegExp(`(${TOKEN_SYMBOLS.join("|")})\\s+(\\d+(?:[.,]\\d+)?)`, "iu");
const TWO_CAPITAL_RE = new RegExp(
  `(\\d+(?:[.,]\\d+)?)\\s*(${TOKEN_SYMBOLS.join("|")})\\b\\s*(?:and|\\+|,|&)\\s*(\\d+(?:[.,]\\d+)?)\\s*(${TOKEN_SYMBOLS.join("|")})\\b`,
  "iu",
);
const PAIR_RE = new RegExp(
  `\\b(${TOKEN_SYMBOLS.join("|")})\\s*[/-]\\s*(${TOKEN_SYMBOLS.join("|")})\\b`,
  "iu",
);
const FEE_BPS_RE = /(\d+(?:\.\d+)?)\s*(bps|bp)\b/iu;
const FEE_PCT_RE = /(\d+(?:\.\d+)?)\s*%/u;

export function parseCreateCapitalAnswer(
  text: string,
): { tokenSymbol: string; amount: string } | null {
  const a = text.match(AMOUNT_TOKEN_RE);
  if (a) return { amount: a[1]!.replace(",", "."), tokenSymbol: a[2]!.toLowerCase() };
  const b = text.match(TOKEN_AMOUNT_RE);
  if (b) return { tokenSymbol: b[1]!.toLowerCase(), amount: b[2]!.replace(",", ".") };
  return null;
}

export function extractCreateGoal(text: string): Partial<CreateGoal> {
  const lower = text.toLowerCase();
  const goal: Partial<CreateGoal> = {};

  const two = text.match(TWO_CAPITAL_RE);
  if (two) {
    goal.capital = {
      amount: two[1]!.replace(",", "."),
      tokenSymbol: two[2]!.toLowerCase(),
    };
    goal.capital2 = {
      amount: two[3]!.replace(",", "."),
      tokenSymbol: two[4]!.toLowerCase(),
    };
    goal.pinnedPair = {
      token0Symbol: two[2]!.toLowerCase(),
      token1Symbol: two[4]!.toLowerCase(),
    };
  } else {
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
      const t = text.match(TOKEN_RE);
      if (t) goal.capital = { tokenSymbol: t[1]!.toLowerCase(), amount: "" };
    }
  }

  for (const [alias, profile] of Object.entries(RISK_ALIASES)) {
    if (riskAliasRegex(alias).test(lower)) {
      goal.riskProfile = profile;
      break;
    }
  }

  const pair = text.match(PAIR_RE);
  if (pair) {
    goal.pinnedPair = {
      token0Symbol: pair[1]!.toLowerCase(),
      token1Symbol: pair[2]!.toLowerCase(),
    };
  }

  const bps = text.match(FEE_BPS_RE);
  if (bps) {
    goal.pinnedFeeTier = Math.round(Number.parseFloat(bps[1]!));
  } else {
    const pct = text.match(FEE_PCT_RE);
    if (pct) {
      const v = Number.parseFloat(pct[1]!);
      if (Number.isFinite(v) && v > 0 && v <= 5) {
        goal.pinnedFeeTier = Math.round(v * 10_000);
      }
    }
  }

  if (/\b(?:stay\s+(?:long|in)|keep\s+my|hold\s+my|long\s+exposure|don'?t\s+sell)\b/iu.test(text)) {
    goal.exposurePreference = "stay-in-token";
  } else if (/\b(?:neutral|balanced|50.?50)\b/iu.test(lower) && goal.riskProfile !== "balanced") {
    goal.exposurePreference = "neutral";
  }

  return goal;
}

export function hasCreateCapital(goal: Partial<CreateGoal> | undefined): boolean {
  if (!goal?.capital) return false;
  return Boolean(goal.capital.tokenSymbol && goal.capital.amount);
}
