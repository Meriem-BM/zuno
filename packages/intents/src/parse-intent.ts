import type { Intent, IntentKind } from "./types.js";

interface Rule {
  kind: IntentKind;
  test: RegExp;
}

const RULES: Rule[] = [
  { kind: "exit", test: /^(?:exit|quit|bye|:q)\s*$/i },
  { kind: "help", test: /^(?:help|\?|\/help)\b/i },
  { kind: "connect_wallet", test: /\bconnect\b.*\bwallet\b/i },
  { kind: "show_balance", test: /\bbalance(?:s)?\b/i },
  { kind: "recommend_rebalance", test: /\b(?:recommend|suggest|rebalance)\b/i },
  { kind: "inspect_position", test: /\b(?:inspect|view|look\s+at)\b.*\bposition\b/i },
  { kind: "list_positions", test: /\b(?:show|list|my|view)\b.*\bpositions?\b/i },
  { kind: "show_diff", test: /\b(?:diff|changes|delta)\b/i },
  { kind: "simulate_plan", test: /\bsimulate\b/i },
  { kind: "apply_plan", test: /\b(?:apply|execute|run)\b.*\bplan\b/i },
  { kind: "agent_status", test: /\bagents?\b.*\b(?:status|health)\b/i },
  { kind: "show_peers", test: /\bpeers\b/i },
];

const POSITION_REFS: RegExp[] = [
  /\bposition\s+([a-z0-9][a-z0-9_-]*)\b/i,
  /\b(pos_[a-z0-9]+)\b/i,
];

const PLAN_REFS: RegExp[] = [/\b(plan_[a-z0-9]+)\b/i];

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1];
  }
  return undefined;
}

export function parseIntent(input: string): Intent {
  const text = input.trim();
  if (!text) return { intent: "unknown", rawInput: input };

  for (const rule of RULES) {
    if (rule.test.test(text)) {
      const out: Intent = { intent: rule.kind, rawInput: text };
      const positionId = firstMatch(text, POSITION_REFS);
      const planId = firstMatch(text, PLAN_REFS);
      if (positionId) out.positionId = positionId;
      if (planId) out.planId = planId;
      return out;
    }
  }

  return { intent: "unknown", rawInput: text };
}
