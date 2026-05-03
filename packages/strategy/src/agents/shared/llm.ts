import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";

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
  model?: string;
  temperature?: number;
}

export interface AgentRunResult<T> {
  output: T;
  id: string;
}

export class AgentResponseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AgentResponseError";
  }
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

  let completion;
  try {
    completion = await attempt(temperature);
  } catch (e) {
    if (isLengthError(e)) {
      try {
        completion = await attempt(0);
      } catch (retryError) {
        if (isLengthError(retryError)) {
          throw new AgentResponseError(
            `Agent ${opts.schemaName} exceeded the model output length limit.`,
            { cause: retryError },
          );
        }
        throw retryError;
      }
    } else {
      throw e;
    }
  }

  const choice = completion.choices[0];
  if (!choice?.message.parsed) {
    const reason = choice?.finish_reason ?? "unknown";
    if (reason === "length") {
      throw new AgentResponseError(
        `Agent ${opts.schemaName} exceeded the model output length limit.`,
      );
    }
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

export function isRecoverableAgentError(error: unknown): boolean {
  if (error instanceof AgentResponseError) return true;
  return isLengthError(error);
}

export function agentsAvailable(): boolean {
  if (process.env.ZUNO_DETERMINISTIC === "true") return false;
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
