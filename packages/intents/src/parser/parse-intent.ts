import type { SessionState } from "@zuno/core";
import { tryResumePending } from "./clarification.js";
import { FALLBACK_CONFIDENCE_THRESHOLD, UNKNOWN_HINT } from "./constants.js";
import { extractEntities, normalize } from "./entities.js";
import {
  ADDRESS_PATTERN,
  PLAN_INTENTS,
  PLAN_REFS,
  POSITION_INTENTS,
  POSITION_REFS,
} from "./rules.js";
import { computeConfidence, correctTypos, scoreIntents } from "./scoring.js";
import type {
  Entities,
  Intent,
  IntentKind,
  ModelFallback,
  ParseOptions,
} from "../contracts/types.js";
import { validateIntent } from "./validation.js";

export { FALLBACK_CONFIDENCE_THRESHOLD };

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

export async function parseIntent(rawInput: string, options: ParseOptions = {}): Promise<Intent> {
  if (options.pending) {
    const resumed = tryResumePending(rawInput, options.pending, options.session);
    if (resumed) return resumed;
  }

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

export function parseIntentDeterministic(rawInput: string, session?: SessionState): Intent {
  const trimmed = rawInput.trim();
  if (!trimmed) return { intent: "unknown", rawInput, confidence: 0 };

  const text = normalize(trimmed);
  const entities = extractEntities(text);
  const addressIntent = inferAddressOnlyIntent(trimmed, text, entities);
  if (addressIntent) return addressIntent;

  const scored = scoreInput(text, entities);
  if (!scored) return { intent: "unknown", rawInput: trimmed, confidence: 0, ...entities };

  const resolved = resolveReferences(scored.intent, scored.text, scored.entities, session);

  return validateIntent({
    intent: scored.intent,
    rawInput: trimmed,
    confidence: scored.confidence,
    ...(scored.corrections.length ? { corrections: scored.corrections } : null),
    ...resolved,
  });
}

function scoreInput(
  text: string,
  entities: Entities,
): {
  intent: IntentKind;
  text: string;
  entities: Entities;
  confidence: number;
  corrections: string[];
} | null {
  let scores = scoreIntents(text, entities);
  let scoredText = text;
  let scoredEntities = entities;
  let corrections: string[] = [];

  if (scores.length === 0) {
    const corrected = correctTypos(text);
    if (corrected.changed) {
      const correctedEntities = extractEntities(corrected.text);
      const correctedScores = scoreIntents(corrected.text, correctedEntities);
      if (correctedScores.length > 0) {
        scores = correctedScores;
        scoredText = corrected.text;
        scoredEntities = correctedEntities;
        corrections = corrected.corrections;
      }
    }
  }

  if (scores.length === 0) return null;

  const top = scores[0]!;
  const second = scores[1];
  const baseConfidence = computeConfidence(top.score, second?.score);
  const confidence = corrections.length
    ? Math.max(0.4, baseConfidence - 0.1 * corrections.length)
    : baseConfidence;

  return {
    intent: top.intent,
    text: scoredText,
    entities: scoredEntities,
    confidence,
    corrections,
  };
}

function inferAddressOnlyIntent(rawInput: string, text: string, entities: Entities): Intent | null {
  if (!entities.walletAddress) return null;
  if (hasNonReadAddressVerb(text)) return null;

  if (isBareAddress(text)) {
    return {
      intent: "list_positions",
      rawInput,
      confidence: 0.9,
      walletAddress: entities.walletAddress,
    };
  }

  const meaningful = text.replace(ADDRESS_PATTERN, "").trim();
  if (!isReadAddressPhrase(meaningful)) return null;

  return {
    intent: "list_positions",
    rawInput,
    confidence: 0.82,
    walletAddress: entities.walletAddress,
  };
}

function resolveReferences(
  intent: IntentKind,
  text: string,
  entities: Entities,
  session: SessionState | undefined,
): Entities {
  if (!session) return entities;
  const out = { ...entities };

  if (!out.positionId && POSITION_INTENTS.has(intent)) {
    if ((POSITION_REFS.test(text) || isShortCommandLikeInput(text)) && session.lastPositionId) {
      out.positionId = session.lastPositionId;
    }
  }
  if (!out.planId && PLAN_INTENTS.has(intent)) {
    if (
      (PLAN_REFS.test(text) || /\bit\b/u.test(text) || isShortCommandLikeInput(text)) &&
      session.lastPlanId
    ) {
      out.planId = session.lastPlanId;
    }
  }
  return out;
}

function isReadAddressPhrase(text: string): boolean {
  if (!text) return true;
  if (/^(?:for|wallet|address|this wallet|this address)$/iu.test(text)) return true;
  return (
    /\b(?:here|this|my|the|pasted|paste|entered|gave|watch|analyze|analyse|scan|review|check|use|using)\b/iu.test(
      text,
    ) && /\b(?:wallet|address|portfolio)?\b/iu.test(text)
  );
}

function hasNonReadAddressVerb(text: string): boolean {
  return /\b(?:send|transfer|pay|swap|buy|sell|bridge|deposit|withdraw)\b/iu.test(text);
}

function isBareAddress(text: string): boolean {
  return new RegExp(`^${ADDRESS_PATTERN.source}$`, "iu").test(text);
}

function isShortCommandLikeInput(text: string): boolean {
  return text.split(/\s+/u).filter(Boolean).length <= 4;
}
