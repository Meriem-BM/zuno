import type { SignerMode } from "@zuno/core";
import type { Entities, Intent, IntentKind } from "../contracts/types.js";

interface Signal {
  pattern: RegExp;
  weight: number;
}

export interface Rule {
  intent: IntentKind;
  signals: Signal[];
  bonus?: (entities: Entities) => number;
}

export type Validator = (intent: Intent) => string | null;

export const POSITION_PATTERNS: RegExp[] = [
  /\bposition\s+([a-z0-9][a-z0-9_-]*)\b/iu,
  /\b(pos_[a-z0-9]+)\b/iu,
];

export const PLAN_PATTERNS: RegExp[] = [
  /\b(plan_[a-z0-9]+)\b/iu,
  /\bplan\s+([a-z0-9][a-z0-9_-]*)\b/iu,
];

export const ADDRESS_PATTERN = /\b(0x[a-f0-9]{40})\b/iu;

const KNOWN_TOKENS = ["eth", "weth", "usdc", "usdt", "dai", "wbtc"] as const;
export const AMOUNT_TOKEN_PATTERN = new RegExp(
  `\\b(\\d+(?:\\.\\d+)?)\\s+(${KNOWN_TOKENS.join("|")})\\b`,
  "iu",
);

export const SIGNER_PATTERNS: { signer: SignerMode; test: RegExp }[] = [
  { signer: "wallet", test: /\b(?:with|using)\s+(?:my\s+)?wallet\b|\bwallet\s+sign(?:er)?\b/iu },
  {
    signer: "enclave",
    test: /\b(?:with|using)\s+(?:the\s+)?enclave\b|\benclave\s+sign(?:er)?\b/iu,
  },
];

export const POSITION_REFS = /\b(?:this|that|the|current)\s+(?:position|one)\b|\bthis one\b/iu;
export const PLAN_REFS =
  /\b(?:this|that|the|current|it)\s+plan\b|\b(?:apply|simulate|show)\s+it\b|^(?:apply|simulate|diff)\s+it\b/iu;

export const POSITION_INTENTS = new Set<IntentKind>([
  "inspect_position",
  "recommend_rebalance",
  "show_rebalance_options",
  "check_range_status",
]);

export const PLAN_INTENTS = new Set<IntentKind>([
  "show_diff",
  "simulate_plan",
  "apply_plan",
  "explain_recommendation",
]);

export const RULES: Rule[] = [
  {
    intent: "exit",
    signals: [
      { pattern: /^(?:exit|quit|bye)$|^:q$/iu, weight: 100 },
      { pattern: /\bgoodbye\b/iu, weight: 60 },
    ],
  },
  {
    intent: "help",
    signals: [
      { pattern: /^(?:help|\?|\/help)\b/iu, weight: 100 },
      { pattern: /\bwhat can (?:you|i) do\b/iu, weight: 80 },
      { pattern: /\bcan i talk to you\b|\bcan we talk\b/iu, weight: 85 },
      {
        pattern: /^(?:hi|hello|hey|yo|sup|gm|good\s+(?:morning|evening|afternoon))\b/iu,
        weight: 75,
      },
    ],
  },
  {
    intent: "connect_wallet",
    signals: [
      { pattern: /\bconnect\b.*\bwallet\b/iu, weight: 90 },
      { pattern: /\b(?:link|attach)\b.*\bwallet\b/iu, weight: 70 },
      { pattern: /\bsign\s*in\b/iu, weight: 50 },
    ],
  },
  {
    intent: "show_watch_target",
    signals: [
      { pattern: /^(?:my\s+)?wallet\s+address$/iu, weight: 100 },
      { pattern: /^(?:my\s+)?(?:wallet|address)$/iu, weight: 85 },
      { pattern: /\bwhat(?:'s| is)\b.*\b(?:wallet|address)\b/iu, weight: 95 },
      {
        pattern:
          /\b(?:which|what)\b.*\b(?:wallet|address)\b.*\b(?:watching|using|target|current)\b/iu,
        weight: 95,
      },
      { pattern: /\b(?:current|active|watch|target)\b.*\b(?:wallet|address)\b/iu, weight: 90 },
      { pattern: /\b(?:show|print|display)\b.*\b(?:wallet|address|watch target)\b/iu, weight: 85 },
    ],
  },
  {
    intent: "create_position",
    signals: [
      { pattern: /\b(?:create|open|mint|new)\b.*\b(?:lp\s+)?positions?\b/iu, weight: 95 },
      { pattern: /\b(?:add|provide)\b.*\bliquidity\b/iu, weight: 90 },
      { pattern: /\b(?:create|open|mint)\b.*\brange\b/iu, weight: 80 },
    ],
  },
  {
    intent: "swap_tokens",
    signals: [
      {
        pattern: /\b(?:swap|trade|exchange|convert)\b.*\b(?:eth|weth|usdc|usdt|dai|wbtc)\b/iu,
        weight: 95,
      },
      { pattern: /\b(?:need|want|trying)\b.*\b(?:swap|trade|exchange|convert)\b/iu, weight: 85 },
      {
        pattern:
          /\b(?:eth|weth|usdc|usdt|dai|wbtc)\b.*\b(?:to|for)\b.*\b(?:eth|weth|usdc|usdt|dai|wbtc)\b/iu,
        weight: 80,
      },
    ],
  },
  {
    intent: "show_balance",
    signals: [
      { pattern: /\bbalances?\b/iu, weight: 80 },
      { pattern: /\bhow much\b.*\bi (?:have|hold)\b/iu, weight: 70 },
      { pattern: /\bwhat(?:'s| is)\b.*\bin my\s+wallet\b/iu, weight: 80 },
      { pattern: /\bwhat(?: do)? i (?:have|hold)\b/iu, weight: 70 },
      { pattern: /\bwhat(?:'s| is) in (?:my )?wallet\b/iu, weight: 80 },
    ],
  },
  {
    intent: "list_out_of_range_positions",
    signals: [
      {
        pattern: /\b(?:which|what|any)\b.*\bpositions?\b.*\b(?:out of range|oor|drift(?:ing)?)\b/iu,
        weight: 95,
      },
      { pattern: /\bout of range\b.*\bpositions?\b/iu, weight: 85 },
    ],
  },
  {
    intent: "list_risky_positions",
    signals: [
      { pattern: /\brisky\b.*\bpositions?\b/iu, weight: 90 },
      { pattern: /\bpositions?\b.*\b(?:at risk|in danger)\b/iu, weight: 85 },
    ],
  },
  {
    intent: "inspect_all_positions",
    signals: [
      { pattern: /\b(?:inspect|check|review|scan)\b.*\ball\b.*\bpositions?\b/iu, weight: 95 },
      { pattern: /\b(?:inspect|review)\s+everything\b/iu, weight: 70 },
    ],
  },
  {
    intent: "list_positions",
    signals: [
      { pattern: /\b(?:pasted|paste|entered|gave)\b.*\b(?:wallet|address)\b/iu, weight: 75 },
      {
        pattern: /\b(?:analyze|analyse|scan|review)\b.*\b(?:wallet|address|portfolio)\b/iu,
        weight: 90,
      },
      { pattern: /\b(?:show|list|view|see|look at|check)\b.*\bpositions?\b/iu, weight: 80 },
      {
        pattern:
          /\b(?:show|list|view|see|look at|check)?\s*(?:my\s+)?(?:lps?|lp|liquidity)\s+positions?\b/iu,
        weight: 90,
      },
      { pattern: /\b(?:look at|check|see|show)\b.*\b(?:my\s+)?lps?\b/iu, weight: 90 },
      { pattern: /\bmy positions?\b/iu, weight: 70 },
      { pattern: /\bwhat positions\b/iu, weight: 60 },
      { pattern: /\bdo i have\b.*\bpositions?\b/iu, weight: 80 },
      { pattern: /\bany positions\b/iu, weight: 70 },
    ],
  },
  {
    intent: "inspect_position",
    signals: [
      { pattern: /\b(?:inspect|examine|look at)\b.*\bposition\b/iu, weight: 90 },
      { pattern: /\b(?:details|status|info)\b.*\bposition\b/iu, weight: 70 },
      { pattern: /^inspect\b/iu, weight: 60 },
    ],
    bonus: (e) => (e.positionId ? 15 : 0),
  },
  {
    intent: "check_range_status",
    signals: [
      { pattern: /\bare we (?:still )?in range\b/iu, weight: 95 },
      { pattern: /\b(?:still )?in range\b/iu, weight: 70 },
      { pattern: /\brange status\b/iu, weight: 80 },
    ],
  },
  {
    intent: "show_rebalance_options",
    signals: [
      {
        pattern: /\b(?:options|alternatives|choices)\b.*\b(?:rebalance|range|position)\b/iu,
        weight: 90,
      },
      { pattern: /\bwhat (?:are )?(?:my )?options\b/iu, weight: 70 },
    ],
  },
  {
    intent: "explain_recommendation",
    signals: [
      { pattern: /\bwhy\b.*\b(?:recommend|chose|pick|that one|this one)\b/iu, weight: 95 },
      { pattern: /\bexplain\b.*\b(?:recommend|plan|choice|why)\b/iu, weight: 90 },
    ],
  },
  {
    intent: "recommend_rebalance",
    signals: [
      { pattern: /\b(?:recommend|suggest|advise)\b/iu, weight: 80 },
      { pattern: /\brebalance\b/iu, weight: 80 },
      { pattern: /\bwhat (?:should|do) i (?:do|need)\b/iu, weight: 75 },
      { pattern: /\bwhat (?:to do|next)\b/iu, weight: 60 },
    ],
  },
  {
    intent: "show_diff",
    signals: [
      { pattern: /\b(?:diff|delta|changes)\b/iu, weight: 85 },
      { pattern: /\bwhat (?:would|will) change\b/iu, weight: 75 },
    ],
  },
  {
    intent: "simulate_plan",
    signals: [
      { pattern: /\bsimulate(?:d|s)?\b|\bsimulation\b/iu, weight: 95 },
      { pattern: /\b(?:preview|dry[-\s]?run)\b/iu, weight: 75 },
    ],
  },
  {
    intent: "apply_plan",
    signals: [
      { pattern: /\b(?:apply|execute|run|commit)\b.*\b(?:plan|it|that|this)\b/iu, weight: 90 },
      { pattern: /\brebalance\s+now\b/iu, weight: 90 },
      { pattern: /\bsign\s+(?:and\s+)?(?:apply|execute|send)\b/iu, weight: 90 },
      { pattern: /^apply\b/iu, weight: 75 },
    ],
  },
  {
    intent: "agent_status",
    signals: [
      { pattern: /\bagents?\b.*\b(?:status|online|health|alive|up|running)\b/iu, weight: 90 },
      { pattern: /\bare the agents (?:up|online|alive|running)\b/iu, weight: 95 },
      { pattern: /\b(?:show|list|view)\s+agents?\b/iu, weight: 85 },
    ],
  },
  {
    intent: "monitor_wallet",
    signals: [
      { pattern: /\b(?:watch|monitor)\b.*\b(?:wallet|positions?|portfolio)\b/iu, weight: 95 },
      { pattern: /\b(?:start|run)\b.*\b(?:watcher|monitor)\b/iu, weight: 80 },
      { pattern: /\bmonitoring\b.*\b(?:status|setup|config)\b/iu, weight: 75 },
    ],
  },
  {
    intent: "show_alerts",
    signals: [
      { pattern: /\b(?:show|list|view|read)\b.*\balerts?\b/iu, weight: 95 },
      { pattern: /\b(?:latest|recent)\b.*\balerts?\b/iu, weight: 85 },
      { pattern: /\bwhat\b.*\b(?:needs attention|changed)\b/iu, weight: 80 },
    ],
  },
  {
    intent: "show_peers",
    signals: [{ pattern: /\b(?:peers|peer list|topology)\b/iu, weight: 90 }],
  },
  {
    intent: "show_logs",
    signals: [
      { pattern: /\b(?:logs?|log output)\b/iu, weight: 85 },
      { pattern: /\b(?:show|view)\s+(?:recent\s+)?activity\b/iu, weight: 70 },
    ],
  },
];

export const REQUIRED_FIELDS: Partial<Record<IntentKind, Validator>> = {
  inspect_position: (i) => (i.positionId ? null : "Which position do you want me to inspect?"),
  recommend_rebalance: (i) => (i.positionId ? null : "Which position should I look at?"),
  show_rebalance_options: (i) =>
    i.positionId ? null : "Which position should I show options for?",
  check_range_status: (i) => (i.positionId ? null : "Which position should I check the range for?"),
  show_diff: (i) => (i.planId ? null : "Which plan would you like the diff for?"),
  simulate_plan: (i) => (i.planId ? null : "Which plan should I simulate?"),
  explain_recommendation: (i) => (i.planId ? null : "Which plan would you like me to explain?"),
  apply_plan: (i) => {
    if (!i.planId) return "Which plan would you like to apply?";
    return null;
  },
};

export const KEYWORD_VOCAB: ReadonlyArray<string> = [
  "show",
  "list",
  "view",
  "see",
  "read",
  "look",
  "inspect",
  "examine",
  "check",
  "scan",
  "review",
  "details",
  "info",
  "analyze",
  "analyse",
  "recommend",
  "suggest",
  "advise",
  "rebalance",
  "explain",
  "create",
  "open",
  "mint",
  "provide",
  "swap",
  "trade",
  "exchange",
  "convert",
  "apply",
  "execute",
  "run",
  "commit",
  "simulate",
  "preview",
  "watch",
  "monitor",
  "monitoring",
  "paste",
  "pasted",
  "entered",
  "gave",
  "connect",
  "link",
  "attach",
  "exit",
  "quit",
  "bye",
  "help",
  "wallet",
  "wallets",
  "balance",
  "balances",
  "address",
  "target",
  "position",
  "positions",
  "plan",
  "plans",
  "diff",
  "diffs",
  "delta",
  "changes",
  "options",
  "alternatives",
  "choices",
  "agent",
  "agents",
  "peer",
  "peers",
  "topology",
  "log",
  "logs",
  "alert",
  "alerts",
  "activity",
  "status",
  "online",
  "health",
  "alive",
  "running",
  "range",
  "risky",
  "danger",
  "current",
  "still",
  "everything",
  "this",
  "that",
  "what",
  "which",
  "any",
];
