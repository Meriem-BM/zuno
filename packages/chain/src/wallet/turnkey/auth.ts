import { generateP256KeyPair } from "@turnkey/crypto";
import { Turnkey } from "@turnkey/sdk-server";
import type { Address } from "@zuno/core";
import { APP_NAME, ETH_ACCOUNT, SESSION_LENGTH_SECONDS, SESSION_TTL_MS } from "./lib/constants.js";
import { isAddressLike, parentClient, postProxy, requireParentOrgId } from "./lib/helpers.js";
import type { OtpHandle, Session, TurnkeyEnv } from "./types.js";

export async function startEmailOtp(
  email: string,
  env: TurnkeyEnv = process.env,
): Promise<OtpHandle> {
  const proxyUrl = env.ZUNO_AUTH_PROXY_URL?.trim();
  if (proxyUrl) {
    const r = await postProxy<{ otpId: string }>(proxyUrl, "/auth/initOtp", { email });
    return { email, otpId: r.otpId };
  }
  const result = await parentClient(env).apiClient().initOtp({
    otpType: "OTP_TYPE_EMAIL",
    contact: email,
    appName: APP_NAME,
  });
  if (!result?.otpId) throw new Error("Turnkey did not return an OTP id.");
  return { email, otpId: result.otpId };
}

export async function completeEmailOtp(
  handle: OtpHandle,
  code: string,
  env: TurnkeyEnv = process.env,
): Promise<Session> {
  const proxyUrl = env.ZUNO_AUTH_PROXY_URL?.trim();
  if (proxyUrl) {
    return completeViaProxy(proxyUrl, handle, code);
  }

  const parent = parentClient(env);

  const verify = await parent.apiClient().verifyOtp({
    otpId: handle.otpId,
    otpCode: code,
    expirationSeconds: String(SESSION_LENGTH_SECONDS),
  });
  if (!verify?.verificationToken) {
    throw new Error("Turnkey rejected the OTP code.");
  }

  const ephemeral = generateP256KeyPair();
  const subOrg = await ensureSubOrganization(parent, handle.email);

  const login = await parent.apiClient().otpLogin({
    organizationId: subOrg.subOrganizationId,
    verificationToken: verify.verificationToken,
    publicKey: ephemeral.publicKey,
    expirationSeconds: String(SESSION_LENGTH_SECONDS),
  });
  if (!login?.session) {
    throw new Error("Turnkey did not return a session JWT.");
  }

  const session: Session = {
    email: handle.email,
    subOrganizationId: subOrg.subOrganizationId,
    agentWalletAddress: subOrg.walletAddress,
    walletId: subOrg.walletId,
    apiPrivateKey: ephemeral.privateKey,
    apiPublicKey: ephemeral.publicKey,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  if (!session.agentWalletAddress || !session.walletId) {
    const wallet = await ensureSubOrgWallet(session, env);
    session.agentWalletAddress = wallet.address;
    session.walletId = wallet.walletId;
  }

  return session;
}

export function userScopedClient(session: Session, env: TurnkeyEnv = process.env): Turnkey {
  return new Turnkey({
    apiBaseUrl: env.TURNKEY_API_BASE_URL ?? "https://api.turnkey.com",
    apiPublicKey: session.apiPublicKey,
    apiPrivateKey: session.apiPrivateKey,
    defaultOrganizationId: session.subOrganizationId,
  });
}

async function completeViaProxy(
  proxyUrl: string,
  handle: OtpHandle,
  code: string,
): Promise<Session> {
  const verify = await postProxy<{ verificationToken: string }>(proxyUrl, "/auth/verifyOtp", {
    otpId: handle.otpId,
    otpCode: code,
  });

  const ephemeral = generateP256KeyPair();
  const login = await postProxy<{
    session: string;
    subOrganizationId: string;
    walletId: string | null;
    walletAddress: string | null;
  }>(proxyUrl, "/auth/login", {
    email: handle.email,
    verificationToken: verify.verificationToken,
    publicKey: ephemeral.publicKey,
  });

  return {
    email: handle.email,
    subOrganizationId: login.subOrganizationId,
    agentWalletAddress: isAddressLike(login.walletAddress) ? login.walletAddress : undefined,
    walletId: login.walletId ?? undefined,
    apiPrivateKey: ephemeral.privateKey,
    apiPublicKey: ephemeral.publicKey,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

interface SubOrgInfo {
  subOrganizationId: string;
  walletId?: string;
  walletAddress?: Address;
}

async function ensureSubOrganization(parent: Turnkey, email: string): Promise<SubOrgInfo> {
  const existing = await parent.apiClient().getSubOrgIds({
    organizationId: requireParentOrgId(),
    filterType: "EMAIL",
    filterValue: email,
  });
  const matchedSubOrgId = existing.organizationIds[0];
  if (matchedSubOrgId) {
    return { subOrganizationId: matchedSubOrgId };
  }

  const created = await parent.apiClient().createSubOrganization({
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
  if (!created?.subOrganizationId) {
    throw new Error("Turnkey did not return a sub-organization id.");
  }
  return {
    subOrganizationId: created.subOrganizationId,
    walletId: created.wallet?.walletId,
    walletAddress: isAddressLike(created.wallet?.addresses?.[0])
      ? created.wallet?.addresses?.[0]
      : undefined,
  };
}

async function ensureSubOrgWallet(
  session: Session,
  env: TurnkeyEnv,
): Promise<{ address: Address; walletId: string }> {
  const client = userScopedClient(session, env).apiClient();
  const wallets = await client.getWallets({ organizationId: session.subOrganizationId });
  const first = wallets.wallets?.[0];
  if (first) {
    const accounts = await client.getWalletAccounts({
      organizationId: session.subOrganizationId,
      walletId: first.walletId,
    });
    const address = accounts.accounts?.[0]?.address;
    if (!isAddressLike(address)) {
      throw new Error("Sub-org wallet has no Ethereum account.");
    }
    return { address, walletId: first.walletId };
  }

  const created = await client.createWallet({
    walletName: "Zuno Agent Wallet",
    accounts: [ETH_ACCOUNT],
    mnemonicLength: 12,
  });
  const address = created.addresses?.[0];
  if (!isAddressLike(address) || !created.walletId) {
    throw new Error("Turnkey did not return a wallet address for the sub-org.");
  }
  return { address, walletId: created.walletId };
}
