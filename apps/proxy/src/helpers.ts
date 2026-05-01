import { Turnkey } from "@turnkey/sdk-server";
import { ETH_ACCOUNT } from "./constants.js";
import type { Env, SubOrgInfo } from "./types.js";

export function parent(env: Env): Turnkey {
  return new Turnkey({
    apiBaseUrl: env.TURNKEY_API_BASE_URL ?? "https://api.turnkey.com",
    defaultOrganizationId: requireEnv(env, "TURNKEY_ORGANIZATION_ID"),
    apiPublicKey: requireEnv(env, "TURNKEY_API_PUBLIC_KEY"),
    apiPrivateKey: requireEnv(env, "TURNKEY_API_PRIVATE_KEY"),
  });
}

export function requireEnv<K extends keyof Env>(env: Env, key: K): string {
  const value = env[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing ${String(key)} in proxy environment.`);
  }
  return value;
}

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function turnkeyError(e: unknown): string {
  return e instanceof Error ? e.message : "turnkey upstream error";
}

export async function ensureSubOrganization(
  tk: Turnkey,
  email: string,
  parentOrgId: string,
): Promise<SubOrgInfo> {
  const existing = await tk.apiClient().getSubOrgIds({
    organizationId: parentOrgId,
    filterType: "EMAIL",
    filterValue: email,
  });
  const matched = existing.organizationIds[0];
  if (matched) return { subOrganizationId: matched };

  const created = await tk.apiClient().createSubOrganization({
    subOrganizationName: `Zuno - ${email}`,
    rootUsers: [
      {
        userName: email,
        userEmail: email,
        apiKeys: [],
        authenticators: [],
        oauthProviders: [],
      },
    ],
    rootQuorumThreshold: 1,
    wallet: {
      walletName: "Zuno Agent Wallet",
      accounts: [ETH_ACCOUNT],
      mnemonicLength: 12,
    },
  });
  if (!created?.subOrganizationId) throw new Error("Turnkey did not return a sub-org id.");
  return {
    subOrganizationId: created.subOrganizationId,
    walletId: created.wallet?.walletId,
    walletAddress: created.wallet?.addresses?.[0],
  };
}
