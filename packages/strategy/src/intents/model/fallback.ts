import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { IntentSchema, toIntent } from "./contract.js";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt.js";
import { noopModelFallback } from "../parser/parse-intent.js";
import type { Intent, ModelFallback } from "../contracts/types.js";

export interface ModelFallbackOptions {
  apiKey?: string;
  groqApiKey?: string;
  model?: string;
  provider?: "openai" | "groq";
  client?: OpenAI;
  fetch?: typeof fetch;
}

export function createModelFallback(options: ModelFallbackOptions = {}): ModelFallback {
  const provider = resolveProvider(options);
  if (provider === "groq") return createGroqFallback(options);
  return createOpenAiFallback(options);
}

function createOpenAiFallback(options: ModelFallbackOptions): ModelFallback {
  const client =
    options.client ??
    (() => {
      const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
      return apiKey ? new OpenAI({ apiKey }) : null;
    })();

  if (!client) return noopModelFallback;

  const model = options.model ?? process.env.ZUNO_INTENT_MODEL ?? "gpt-4o-mini";

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
        return parsed ? toIntent(input, parsed) : null;
      } catch (error) {
        if (process.env.ZUNO_DEBUG_INTENTS === "true") {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[zuno:intents] model fallback failed: ${message}`);
        }
        return null;
      }
    },
  };
}

function createGroqFallback(options: ModelFallbackOptions): ModelFallback {
  const apiKey = options.groqApiKey ?? options.apiKey ?? process.env.GROQ_API_KEY;
  if (!apiKey) return noopModelFallback;

  const request = options.fetch ?? fetch;
  const model = options.model ?? process.env.ZUNO_INTENT_MODEL ?? "llama-3.1-8b-instant";

  return {
    async parse(input, session): Promise<Intent | null> {
      try {
        const response = await request("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            messages: [
              {
                role: "system",
                content: `${SYSTEM_PROMPT}\n\nReturn only one JSON object that matches the intent schema. Do not wrap it in markdown.`,
              },
              { role: "user", content: buildUserMessage(input, session) },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(
            `Groq ${response.status} ${response.statusText}${body ? `: ${body}` : ""}`,
          );
        }

        const payload = (await response.json()) as GroqChatCompletion;
        const content = payload.choices?.[0]?.message?.content;
        if (!content) return null;

        return toIntent(input, JSON.parse(content));
      } catch (error) {
        if (process.env.ZUNO_DEBUG_INTENTS === "true") {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[zuno:intents] groq fallback failed: ${message}`);
        }
        return null;
      }
    },
  };
}

function resolveProvider(options: ModelFallbackOptions): "openai" | "groq" {
  const configured = (options.provider ?? process.env.ZUNO_INTENT_PROVIDER)?.trim().toLowerCase();
  if (configured === "groq" || configured === "openai") return configured;
  if (configured && process.env.ZUNO_DEBUG_INTENTS === "true") {
    console.error(`[zuno:intents] unknown provider "${configured}", using openai`);
  }
  return "openai";
}

interface GroqChatCompletion {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}
