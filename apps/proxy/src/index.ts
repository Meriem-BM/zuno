import { Hono } from "hono";
import { cors } from "hono/cors";
import { APP_NAME, SESSION_LENGTH_SECONDS } from "./constants.js";
import { ensureSubOrganization, isEmail, parent, turnkeyError } from "./helpers.js";
import type { Env, InitOtpBody, LoginBody, VerifyOtpBody } from "./types.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors({ origin: "*", allowHeaders: ["content-type", "x-zuno-version"] }));

app.get("/healthz", (c) => c.json({ ok: true }));

app.post("/auth/initOtp", async (c) => {
  const body: InitOtpBody = await c.req.json<InitOtpBody>().catch(() => ({}) as InitOtpBody);
  if (!isEmail(body.email)) return c.json({ error: "email required" }, 400);

  try {
    const result = await parent(c.env).apiClient().initOtp({
      otpType: "OTP_TYPE_EMAIL",
      contact: body.email,
      appName: APP_NAME,
    });
    if (!result?.otpId) return c.json({ error: "no otp id from turnkey" }, 502);
    return c.json({ otpId: result.otpId });
  } catch (e) {
    return c.json({ error: turnkeyError(e) }, 502);
  }
});

app.post("/auth/verifyOtp", async (c) => {
  const body: VerifyOtpBody = await c.req.json<VerifyOtpBody>().catch(() => ({}) as VerifyOtpBody);
  if (!body.otpId || !body.otpCode) {
    return c.json({ error: "otpId and otpCode required" }, 400);
  }

  try {
    const result = await parent(c.env)
      .apiClient()
      .verifyOtp({
        otpId: body.otpId,
        otpCode: body.otpCode,
        expirationSeconds: String(SESSION_LENGTH_SECONDS),
      });
    if (!result?.verificationToken) {
      return c.json({ error: "verification rejected" }, 401);
    }
    return c.json({ verificationToken: result.verificationToken });
  } catch (e) {
    return c.json({ error: turnkeyError(e) }, 502);
  }
});

app.post("/auth/login", async (c) => {
  const body: LoginBody = await c.req.json<LoginBody>().catch(() => ({}) as LoginBody);
  if (!isEmail(body.email) || !body.verificationToken || !body.publicKey) {
    return c.json({ error: "email, verificationToken, publicKey required" }, 400);
  }

  try {
    const tk = parent(c.env);
    const sub = await ensureSubOrganization(tk, body.email, c.env.TURNKEY_ORGANIZATION_ID);
    const login = await tk.apiClient().otpLogin({
      organizationId: sub.subOrganizationId,
      verificationToken: body.verificationToken,
      publicKey: body.publicKey,
      expirationSeconds: String(SESSION_LENGTH_SECONDS),
    });
    if (!login?.session) return c.json({ error: "no session from turnkey" }, 502);

    return c.json({
      session: login.session,
      subOrganizationId: sub.subOrganizationId,
      walletId: sub.walletId ?? null,
      walletAddress: sub.walletAddress ?? null,
    });
  } catch (e) {
    return c.json({ error: turnkeyError(e) }, 502);
  }
});

export default app;
