import type { Entities, IntentScore } from "../contracts/types.js";
import { KEYWORD_VOCAB, RULES } from "./rules.js";

export interface TypoCorrection {
  text: string;
  changed: boolean;
  corrections: string[];
}

export function scoreIntents(text: string, entities: Entities): IntentScore[] {
  const scores: IntentScore[] = [];
  for (const rule of RULES) {
    let score = 0;
    for (const signal of rule.signals) {
      if (signal.pattern.test(text)) score += signal.weight;
    }
    if (rule.bonus) score += rule.bonus(entities);
    if (score > 0) scores.push({ intent: rule.intent, score });
  }
  return scores.sort((a, b) => b.score - a.score);
}

export function computeConfidence(top: number, second: number | undefined): number {
  const base = 0.5 + Math.min(top / 100, 1) * 0.45;
  if (second === undefined) return clamp(base);
  const margin = (top - second) / Math.max(top, 1);
  return clamp(base * (0.85 + 0.15 * margin));
}

export function correctTypos(text: string): TypoCorrection {
  const tokens = text.split(/(\s+)/u);
  const corrections: string[] = [];
  let changed = false;

  const result = tokens.map((tok) => {
    if (!/\S/.test(tok)) return tok;
    const lower = tok.toLowerCase();
    if (lower.length < 4) return tok;
    if (KEYWORD_VOCAB.includes(lower)) return tok;
    if (/^(?:0x[a-f0-9]+|pos_[a-z0-9]+|plan_[a-z0-9]+|\d+)$/iu.test(tok)) return tok;

    const fixed = closestVocabWord(lower);
    if (fixed && fixed !== lower) {
      corrections.push(`${lower}→${fixed}`);
      changed = true;
      return fixed;
    }
    return tok;
  });

  return { text: result.join(""), changed, corrections };
}

function clamp(n: number): number {
  return Math.min(0.95, Math.max(0, n));
}

function closestVocabWord(word: string): string | null {
  const budget = word.length <= 4 ? 1 : 2;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const v of KEYWORD_VOCAB) {
    if (Math.abs(v.length - word.length) > budget) continue;
    const d = lev(word, v);
    if (d < bestDist && d <= budget) {
      bestDist = d;
      best = v;
    }
  }
  return best;
}

function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}
