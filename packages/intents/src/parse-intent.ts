import type { SessionState } from "@zuno/core";
import {
  ADDRESS_PATTERN,
  AMOUNT_TOKEN_PATTERN,
  PLAN_INTENTS,
  PLAN_PATTERNS,
  PLAN_REFS,
  POSITION_INTENTS,
  POSITION_PATTERNS,
  POSITION_REFS,
  REQUIRED_FIELDS,
  RULES,
  SIGNER_PATTERNS,
} from "./rules.js";
import type {
  Entities,
  Intent,
  IntentKind,
  IntentScore,
  ModelFallback,
  ParseOptions,
} from "./types.js";

export const FALLBACK_CONFIDENCE_THRESHOLD = 0.5;

export const noopModelFallback: ModelFallback = {
  async parse() {
    return null;
  },
};

export function shouldUseModelFallback(intent: Intent): boolean {
  if (intent.intent === "needs_clarification") return false;
  if (intent.intent === "exit") return false;
  if (intent.intent === "unknown") return true;
  return intent.confidence < FALLBACK_CONFIDENCE_THRESHOLD;
}

/**
 * Pipeline: normalize → extract entities → score intents → resolve session
 * references → validate required fields → consult model fallback for
 * unknown / low-confidence input → fall back to a friendly clarification.
 */
export async function parseIntent(
  rawInput: string,
  options: ParseOptions = {},
): Promise<Intent> {
  const deterministic = parseIntentDeterministic(rawInput, options.session);
  if (deterministic.intent === "exit") return deterministic;
  if (deterministic.intent === "needs_clarification") return deterministic;

  if (options.fallback && shouldUseModelFallback(deterministic)) {
    const guess = await options.fallback.parse(rawInput, options.session);
    if (guess) return guess;
  }

  if (deterministic.intent === "unknown" && deterministic.confidence === 0) {
    return {
      ...deterministic,
      intent: "needs_clarification",
      confidence: 0.2,
      clarification: UNKNOWN_HINT,
    };
  }
  return deterministic;
}

const UNKNOWN_HINT =
  'Not sure what you mean. Try "show my positions", "inspect position 42", or "help".';

export function parseIntentDeterministic(
  rawInput: string,
  session?: SessionState,
): Intent {
  const trimmed = rawInput.trim();
  if (!trimmed) return { intent: "unknown", rawInput, confidence: 0 };

  const text = normalize(trimmed);
  const entities = extractEntities(text);
  const scores = scoreIntents(text, entities);
  if (scores.length === 0) {
    return { intent: "unknown", rawInput: trimmed, confidence: 0, ...entities };
  }

  const top = scores[0]!;
  const second = scores[1];
  const confidence = computeConfidence(top.score, second?.score);
  const resolved = resolveReferences(top.intent, text, entities, session);

  return validateIntent({
    intent: top.intent,
    rawInput: trimmed,
    confidence,
    ...resolved,
  });
}

function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[?!.]+$/u, "")
    .replace(/\s+/gu, " ");
}

function extractEntities(text: string): Entities {
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

function scoreIntents(text: string, entities: Entities): IntentScore[] {
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

/**
 * Fill `positionId` / `planId` from session when the user used a deictic
 * reference ("this", "it", "that") or a short command-like input. Signer mode
 * is NOT auto-filled — the user must restate it each time so a stale session
 * can't silently change which key signs.
 */
function resolveReferences(
  intent: IntentKind,
  text: string,
  entities: Entities,
  session: SessionState | undefined,
): Entities {
  if (!session) return entities;
  const out = { ...entities };

  if (!out.positionId && POSITION_INTENTS.has(intent)) {
    if (POSITION_REFS.test(text) || isShortCommandLikeInput(text)) {
      if (session.lastPositionId) out.positionId = session.lastPositionId;
    }
  }
  if (!out.planId && PLAN_INTENTS.has(intent)) {
    if (containsPlanReferencePronoun(text) || isShortCommandLikeInput(text)) {
      if (session.lastPlanId) out.planId = session.lastPlanId;
    }
  }
  return out;
}

function containsPlanReferencePronoun(text: string): boolean {
  if (PLAN_REFS.test(text)) return true;
  return /\bit\b/u.test(text);
}

function validateIntent(intent: Intent): Intent {
  const validate = REQUIRED_FIELDS[intent.intent];
  if (!validate) return intent;
  const clarification = validate(intent);
  if (!clarification) return intent;
  return {
    intent: "needs_clarification",
    rawInput: intent.rawInput,
    confidence: Math.min(0.4, intent.confidence * 0.5),
    clarification,
  };
}

/** Map raw score + second-place margin into a [0, 0.95] band. Capped below
 *  1.0 so a deterministic match never claims certainty. */
function computeConfidence(top: number, second: number | undefined): number {
  const base = 0.5 + Math.min(top / 100, 1) * 0.45;
  if (second === undefined) return clamp(base);
  const margin = (top - second) / Math.max(top, 1);
  return clamp(base * (0.85 + 0.15 * margin));
}

function clamp(n: number): number {
  return Math.min(0.95, Math.max(0, n));
}

function firstCapture(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1];
  }
  return undefined;
}

function isShortCommandLikeInput(text: string): boolean {
  return text.split(/\s+/u).filter(Boolean).length <= 4;
}
