# @zuno/proxy

Auth proxy for the public `zuno` CLI. Holds the parent-org Turnkey credentials so the CLI never sees them. Three endpoints:

```
POST /auth/initOtp    { email }                                  → { otpId }
POST /auth/verifyOtp  { otpId, otpCode }                         → { verificationToken }
POST /auth/login      { email, verificationToken, publicKey }    → { session, subOrganizationId,
                                                                     walletId, walletAddress }
```

After `/auth/login`, the CLI uses the session keys it derived locally to talk to Turnkey directly - the proxy is out of the path.

## Deploy (Cloudflare Workers)

```bash
pnpm --filter @zuno/proxy install
wrangler login
wrangler secret put TURNKEY_ORGANIZATION_ID --name zuno-auth
wrangler secret put TURNKEY_API_PUBLIC_KEY  --name zuno-auth
wrangler secret put TURNKEY_API_PRIVATE_KEY --name zuno-auth
pnpm --filter @zuno/proxy deploy
```

That gives you `https://zuno-auth.<account>.workers.dev`. Bake it into the published CLI by passing `ZUNO_PUBLIC_PROXY_URL=https://zuno-auth.<account>.workers.dev` at build time, or set `ZUNO_AUTH_PROXY_URL` in the user's environment to override.

## Local dev

```bash
# node host (apps/proxy/src/server.ts → :8787)
pnpm --filter @zuno/proxy node

# wrangler simulator (closer to the production runtime → :8787)
pnpm --filter @zuno/proxy dev
```

For local secrets, drop them in `apps/proxy/.dev.vars` (gitignored). Same `KEY=value` shape as `.env`.

## Threat model

Turnkey's architecture gives a parent organization **read-only** access to its sub-organizations by default - parents can observe but not sign on a user's behalf. Each user's wallet is gated by their own session API key, derived locally during `/auth/login` and never seen by the proxy.

The parent-org private key only lives on the proxy host, set via `wrangler secret` (or as host env vars for the Node deployment). Compromise of that key would let an attacker bootstrap new sub-orgs, but **not** sign for existing users - their session keys are out of reach.
