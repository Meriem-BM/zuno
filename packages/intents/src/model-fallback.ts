import type { SessionState } from "@zuno/core";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { noopModelFallback } from "./parse-intent.js";
import type { Intent, ModelFallback } from "./types.js";

const INTENT_KINDS = [
  "exit",
  "help",
  "connect_wallet",
  "show_balance",
  "list_positions",
  "inspect_position",
  "inspect_all_positions",
  "check_range_status",
  "list_out_of_range_positions",
  "list_risky_positions",
  "recommend_rebalance",
  "show_rebalance_options",
  "explain_recommendation",
  "show_diff",
  "simulate_plan",
  "apply_plan",
  "agent_status",
  "show_peers",
  "show_logs",
  "unknown",
  "needs_clarification",
] as const;

const IntentSchema = z.object({
  intent: z.enum(INTENT_KINDS),
  confidence: z.number().min(0).max(1),
  positionId: z.string().nullish(),
  planId: z.string().nullish(),
  walletAddress: z.string().nullish(),
  signerMode: z.enum(["wallet", "enclave"]).nullish(),
  amount: z.string().nullish(),
  tokenSymbol: z.string().nullish(),
  clarification: z.string().nullish(),
});

const SYSTEM_PROMPT = `You are Zuno's intent classifier.

Zuno is a terminal-native copilot for Uniswap liquidity providers. Users type plain English; you map each input to a structured intent.

# Available intents

- exit: leave the shell ("exit", "quit", "bye")
- help: greetings, "what can you do", help requests
- connect_wallet: connect a wallet
- show_balance: show wallet balance / what tokens are held
- list_positions: list the user's LP positions
- inspect_position: look at one position in detail (needs positionId)
- inspect_all_positions: look at every position
- check_range_status: is a position in or out of range (needs positionId)
- list_out_of_range_positions: which positions drifted out of range
- list_risky_positions: which positions are at risk
- recommend_rebalance: suggest a rebalance (needs positionId)
- show_rebalance_options: show alternative candidates (needs positionId)
- explain_recommendation: explain why a plan was chosen (needs planId)
- show_diff: show what changes with a plan (needs planId)
- simulate_plan: simulate before applying (needs planId)
- apply_plan: sign and execute (needs planId AND signerMode)
- agent_status: are the watcher/planner/risk agents alive
- show_peers: connected peers in the agent mesh
- show_logs: recent agent logs
- unknown: genuinely nonsensical input
- needs_clarification: recognisable intent missing a required reference

# Entities

Extract when present: positionId (e.g. "42", "pos_4f2a3b"), planId (e.g. "plan_abc"), walletAddress (0x-prefixed), amount + tokenSymbol (e.g. "10 usdc"), signerMode ("wallet" | "enclave" — only when user explicitly says so).

# Rules

1. confidence in [0, 1]. Use ≥ 0.85 only for clear input.
2. Deictics ("this", "it", "that"): use session.lastPositionId / lastPlanId to fill in.
3. NEVER auto-fill signerMode from session — user must restate "with wallet" / "with enclave" each time.
4. If a required reference is missing and can't be resolved from session, return intent="needs_clarification" with a one-sentence clarification.
5. Greetings → intent="help", confidence ≥ 0.85.
6. Truly nonsensical input → intent="unknown", confidence=0.`;

export interface ModelFallbackOptions {
  apiKey?: string;
  model?: string;
  client?: OpenAI;
}

/**
 * Build a `ModelFallback` backed by a hosted LLM. Returns a no-op fallback
 * when no API key is available, so callers can always wire it up safely.
 */
export function createModelFallback(
  options: ModelFallbackOptions = {},
): ModelFallback {
  const client =
    options.client ??
    (() => {
      const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
      return apiKey ? new OpenAI({ apiKey }) : null;
    })();

  if (!client) return noopModelFallback;

  const model = options.model ?? "gpt-4o-mini";

  return {
    async parse(input, session): Promise<Intent | null> {
      try {
        const completion = await client.beta.chat.completions.parse({
          model,
          temperature: 0,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserMessage(input, session) },
          ],
          response_format: zodResponseFormat(IntentSchema, "intent"),
        });

        const parsed = completion.choices[0]?.message.parsed;
        if (!parsed) return null;

        const result: Intent = {
          intent: parsed.intent,
          rawInput: input,
          confidence: parsed.confidence,
        };
        if (parsed.positionId) result.positionId = parsed.positionId;
        if (parsed.planId) result.planId = parsed.planId;
        if (parsed.walletAddress) result.walletAddress = parsed.walletAddress;
        if (parsed.signerMode) result.signerMode = parsed.signerMode;
        if (parsed.amount) result.amount = parsed.amount;
        if (parsed.tokenSymbol) result.tokenSymbol = parsed.tokenSymbol;
        if (parsed.clarification) result.clarification = parsed.clarification;
        return result;
      } catch {
        return null;
      }
    },
  };
}

function buildUserMessage(input: string, session: SessionState | undefined): string {
  const ctx = session
    ? `Session: position=${session.lastPositionId ?? "—"} plan=${session.lastPlanId ?? "—"} signer=${session.signerMode ?? "—"} wallet=${session.walletAddress ?? "—"}`
    : "Session: (none)";
  return `${ctx}\n\nUser said: ${input}`;
}
