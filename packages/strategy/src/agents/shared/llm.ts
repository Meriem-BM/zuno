import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";

// Every agent uses structured outputs (zod schema → typed JSON), never
// free-form text. Keeps the CLI rendering deterministic.

let cachedClient: OpenAI | null = null;

export function getOpenAi(): OpenAI | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

export interface AgentRunOptions<S extends z.ZodTypeAny> {
  system: string;
  user: string;
  schema: S;
  schemaName: string;
  // Default gpt-4o-mini. Override per-agent if needed.
  model?: string;
  // Default 0.4 for proposal/revision; 0.0 for critic/arbiter.
  temperature?: number;
}

export interface AgentRunResult<T> {
  output: T;
  id: string;
}

export async function runAgent<S extends z.ZodTypeAny>(
  opts: AgentRunOptions<S>,
): Promise<AgentRunResult<z.infer<S>>> {
  const client = getOpenAi();
  if (!client) {
    throw new Error(
      "OPENAI_API_KEY not set. Zuno agents require an OpenAI key for the debate flow. " +
        "Set OPENAI_API_KEY or set ZUNO_DETERMINISTIC=true for the deterministic fallback.",
    );
  }
  const model = opts.model ?? process.env.ZUNO_AGENT_MODEL ?? "gpt-4o-mini";
  const temperature = opts.temperature ?? 0.4;

  const completion = await client.beta.chat.completions.parse({
    model,
    temperature,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: zodResponseFormat(opts.schema, opts.schemaName),
  });

  const choice = completion.choices[0];
  if (!choice?.message.parsed) {
    throw new Error(`Agent ${opts.schemaName} returned no parsed output (model=${model}).`);
  }
  return { output: choice.message.parsed, id: completion.id };
}

export function agentsAvailable(): boolean {
  if (process.env.ZUNO_DETERMINISTIC === "true") return false;
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
