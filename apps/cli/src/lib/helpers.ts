export function configuredFallbackProvider(): string | null {
  const provider = process.env.ZUNO_INTENT_PROVIDER?.trim().toLowerCase();
  if (provider === "groq") return "Groq";
  if (provider === "openai") return "OpenAI";
  if (process.env.OPENAI_API_KEY) return "OpenAI";
  if (process.env.GROQ_API_KEY) return "Groq";
  return null;
}

export interface EnvironmentNotice {
  key: string;
  message: string;
}

const RPC_ENV_KEYS = [
  "ZUNO_MAINNET_RPC_URL",
  "ZUNO_OPTIMISM_RPC_URL",
  "ZUNO_BASE_RPC_URL",
  "ZUNO_ARBITRUM_RPC_URL",
  "ZUNO_SEPOLIA_RPC_URL",
  "ZUNO_BASE_SEPOLIA_RPC_URL",
  "ZUNO_ARBITRUM_SEPOLIA_RPC_URL",
  "ZUNO_UNICHAIN_SEPOLIA_RPC_URL",
] as const;

export function environmentNotices(): EnvironmentNotice[] {
  const notices: EnvironmentNotice[] = [];
  const hasLlmKey = Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim());
  const deterministic = process.env.ZUNO_DETERMINISTIC === "true";
  if (!hasLlmKey && !deterministic) {
    notices.push({
      key: "llm",
      message:
        "Set OPENAI_API_KEY for agent debate; rebalance can fall back, create needs LLM or ZUNO_DETERMINISTIC=true.",
    });
  }

  if (!process.env.ZUNO_UNISWAP_TRADING_API_KEY?.trim()) {
    notices.push({
      key: "trading",
      message: "Set ZUNO_UNISWAP_TRADING_API_KEY to enable executable standalone swaps.",
    });
  }

  if (!RPC_ENV_KEYS.some((key) => process.env[key]?.trim())) {
    notices.push({
      key: "rpc",
      message:
        "Set a chain RPC env var like ZUNO_ARBITRUM_RPC_URL to avoid public RPC rate limits.",
    });
  }

  const hasAuthProxy = Boolean(process.env.ZUNO_AUTH_PROXY_URL?.trim());
  const hasTurnkeyParent = Boolean(
    process.env.TURNKEY_ORGANIZATION_ID?.trim() &&
    process.env.TURNKEY_API_PUBLIC_KEY?.trim() &&
    process.env.TURNKEY_API_PRIVATE_KEY?.trim(),
  );
  if (!hasAuthProxy && !hasTurnkeyParent) {
    notices.push({
      key: "auth",
      message: "Wallet sign-in needs the hosted auth proxy or local Turnkey parent env vars.",
    });
  }

  return notices;
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
