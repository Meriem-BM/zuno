export function configuredFallbackProvider(): string | null {
  const provider = process.env.ZUNO_INTENT_PROVIDER?.trim().toLowerCase();
  if (provider === "groq") return "Groq";
  if (provider === "openai") return "OpenAI";
  if (process.env.OPENAI_API_KEY) return "OpenAI";
  if (process.env.GROQ_API_KEY) return "Groq";
  return null;
}

export function sanitizeInput(value: string): string {
  const esc = "\\u001B";
  const bel = "\\u0007";
  return value
    .replace(new RegExp(`${esc}\\[(?:200|201)~`, "gu"), "")
    .replace(new RegExp(`${esc}\\[[0-?]*[ -/]*[@-~]`, "gu"), "")
    .replace(new RegExp(`${esc}\\][^${bel}]*(?:${bel}|${esc}\\\\)`, "gu"), "")
    .trim();
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function isOtpExpiredError(message: string): boolean {
  return /\botp\b.*\b(expired|invalid)\b/iu.test(message);
}
