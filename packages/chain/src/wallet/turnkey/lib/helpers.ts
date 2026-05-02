import { chainConfig, viemChainFor } from "@zuno/chain/config";
import type { Address, ChainId } from "@zuno/core";
import { Turnkey } from "@turnkey/sdk-server";
import { createPublicClient, http } from "viem";
import { DEFAULT_SESSION_PATH } from "./constants.js";
import type { Session, TurnkeyEnv } from "../types.js";

export function sessionPath(): string {
  return process.env.ZUNO_SESSION_PATH?.trim() || DEFAULT_SESSION_PATH;
}

export function isValidSession(s: unknown): s is Session {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.email === "string" &&
    typeof o.subOrganizationId === "string" &&
    typeof o.apiPrivateKey === "string" &&
    typeof o.apiPublicKey === "string" &&
    typeof o.expiresAt === "number"
  );
}

export function parentClient(env: TurnkeyEnv): Turnkey {
  return new Turnkey({
    apiBaseUrl: env.TURNKEY_API_BASE_URL ?? "https://api.turnkey.com",
    defaultOrganizationId: requireEnv(env, "TURNKEY_ORGANIZATION_ID"),
    apiPublicKey: requireEnv(env, "TURNKEY_API_PUBLIC_KEY"),
    apiPrivateKey: requireEnv(env, "TURNKEY_API_PRIVATE_KEY"),
  });
}

export function requireEnv(env: TurnkeyEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing ${key}; configure parent Turnkey credentials in .env.`);
  return value;
}

export function requireParentOrgId(env: TurnkeyEnv = process.env): string {
  return requireEnv(env, "TURNKEY_ORGANIZATION_ID");
}

export function isAddressLike(value: unknown): value is Address {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/u.test(value);
}

export function publicClient(chainId: ChainId): ReturnType<typeof createPublicClient> {
  const config = chainConfig(chainId);
  return createPublicClient({
    chain: viemChainFor(chainId),
    transport: http(config.rpcUrl),
  }) as ReturnType<typeof createPublicClient>;
}

export function caip2For(chainId: ChainId): string {
  return `eip155:${chainId}`;
}

export async function postProxy<T>(
  proxyUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = `${proxyUrl.replace(/\/$/u, "")}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message: string;
    try {
      const data = (await res.json()) as { error?: string };
      message = data.error ?? `proxy ${path} failed (${res.status})`;
    } catch {
      message = `proxy ${path} failed (${res.status})`;
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}
