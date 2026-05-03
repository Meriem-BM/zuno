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

  // Schemas render under 2KB; 4000 is plenty and bounds runaway generation.
  const MAX_TOKENS = 4000;

  const attempt = async (attemptTemperature: number) =>
    client.beta.chat.completions.parse({
      model,
      temperature: attemptTemperature,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: zodResponseFormat(opts.schema, opts.schemaName),
    });

  // gpt-4o-mini occasionally hits the output cap on first try; retry once
  // at temperature 0 to nudge it toward a more compact response.
  let completion;
  try {
    completion = await attempt(temperature);
  } catch (e) {
    if (isLengthError(e)) {
      completion = await attempt(0);
    } else {
      throw e;
    }
  }

  const choice = completion.choices[0];
  if (!choice?.message.parsed) {
    const reason = choice?.finish_reason ?? "unknown";
    throw new Error(
      `Agent ${opts.schemaName} returned no parsed output (model=${model}, finish=${reason}).`,
    );
  }
  return { output: choice.message.parsed, id: completion.id };
}

function isLengthError(e: unknown): boolean {
  if (e instanceof Error) {
    if (e.name === "LengthFinishReasonError") return true;
    if (e.message.toLowerCase().includes("length limit")) return true;
  }
  return false;
}

export function agentsAvailable(): boolean {
  if (process.env.ZUNO_DETERMINISTIC === "true") return false;
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
