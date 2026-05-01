import { defaultChainId } from "@zuno/chain/config";
import { createSession, type SessionState } from "@zuno/core";
import {
  createModelFallback,
  parseIntent,
  type Intent,
  type PendingClarification,
} from "@zuno/strategy/intents";
import {
  completeEmailOtp,
  createTurnkeyAgentWalletService,
  loadSession,
  saveSession,
  startEmailOtp,
  type AgentWalletService,
  type OtpHandle,
} from "@zuno/chain/wallet";
import { useApp, useInput } from "ink";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeParsed, pendingFromIntent } from "../shell/run-intent.js";
import type { AuthFlowState, Shell, Turn } from "../types/index.js";
import { WALLET_INTENTS } from "../lib/constants.js";
import {
  configuredFallbackProvider,
  errorMessage,
  isOtpExpiredError,
  sanitizeInput,
} from "../lib/helpers.js";

export function useShell(): Shell {
  const { exit } = useApp();
  const session = useMemo(() => createSession(), []);

  const [snapshot, setSnapshot] = useState<SessionState>(() => session.get());
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [fallbackActive, setFallbackActive] = useState(false);
  const [clarification, setClarification] = useState<PendingClarification | null>(null);
  const [walletService, setWalletService] = useState<AgentWalletService | null>(null);
  const [auth, setAuth] = useState<AuthFlowState | null>(null);
  const [otpHandle, setOtpHandle] = useState<OtpHandle | null>(null);
  const [heldIntent, setHeldIntent] = useState<{ text: string; intent: Intent } | null>(null);

  const fallbackProvider = useMemo(() => configuredFallbackProvider(), []);
  const fallback = useMemo(() => {
    const modelFallback = createModelFallback();
    return {
      async parse(input: string, current: SessionState | undefined) {
        setFallbackActive(true);
        try {
          return await modelFallback.parse(input, current);
        } finally {
          setFallbackActive(false);
        }
      },
    };
  }, []);

  // Hydrate session from disk on startup.
  useEffect(() => {
    void (async () => {
      const stored = await loadSession();
      if (!stored) return;
      const next = session.update({
        agentWalletAddress: (stored.agentWalletAddress as `0x${string}` | undefined) ?? null,
        chainId: defaultChainId(),
      });
      setSnapshot(next);
      setWalletService(createTurnkeyAgentWalletService(stored));
    })();
  }, [session]);

  useInput((_, key) => {
    if (key.escape) exit();
  });

  const finishTurn = useCallback(
    (text: string, run: { intent: Intent; result?: Turn["result"]; session: SessionState }) => {
      if (run.intent.intent === "exit") {
        exit();
        return;
      }
      const next = session.update(run.session);
      setSnapshot(next);
      setTurns((prev) => [
        ...prev,
        { id: prev.length, input: text, intent: run.intent, result: run.result },
      ]);
      setClarification(pendingFromIntent(run.intent));
    },
    [exit, session],
  );

  const recordTurnError = useCallback((text: string, message: string) => {
    setTurns((prev) => [
      ...prev,
      {
        id: prev.length,
        input: text,
        intent: { intent: "unknown", rawInput: text, confidence: 0 },
        result: {
          tool: "unknown",
          status: "error",
          message: `Shell error: ${message}`,
          errorCode: "TOOL_EXECUTION_FAILED",
        },
      },
    ]);
  }, []);

  const replayHeldIntent = useCallback(
    async (service: AgentWalletService, held: { text: string; intent: Intent }) => {
      try {
        const run = await executeParsed(held.intent, session.get(), { walletService: service });
        finishTurn(held.text, run);
      } catch (e) {
        recordTurnError(held.text, errorMessage(e));
      }
    },
    [finishTurn, recordTurnError, session],
  );

  const submitAuth = useCallback(
    (value: string) => {
      const text = value.trim();
      if (!text) return;
      setDraft("");

      if (auth?.stage === "email" || auth?.stage === "failed") {
        setAuth({ stage: "sending", email: text });
        void (async () => {
          try {
            const handle = await startEmailOtp(text);
            setOtpHandle(handle);
            setAuth({ stage: "code", email: text });
          } catch (e) {
            setAuth({ stage: "failed", email: text, error: errorMessage(e) });
          }
        })();
        return;
      }

      if (auth?.stage === "code" && otpHandle) {
        const email = auth.email;
        setAuth({ stage: "verifying", email });
        void (async () => {
          try {
            const fresh = await completeEmailOtp(otpHandle, text);
            await saveSession(fresh);
            const service = createTurnkeyAgentWalletService(fresh);
            setWalletService(service);
            setAuth({ stage: "done", email });
            const next = session.update({
              agentWalletAddress: (fresh.agentWalletAddress as `0x${string}` | undefined) ?? null,
              chainId: defaultChainId(),
            });
            setSnapshot(next);
            const held = heldIntent;
            setHeldIntent(null);
            setOtpHandle(null);
            setTimeout(() => setAuth(null), 800);
            if (held) await replayHeldIntent(service, held);
          } catch (e) {
            const message = errorMessage(e);
            // OTP codes are single-use — once verify rejects, the same
            // otpId is dead and must be re-issued.
            if (isOtpExpiredError(message)) {
              setOtpHandle(null);
              setAuth({
                stage: "email",
                error: "That code didn't match. Enter your email to send a new one.",
              });
            } else {
              setAuth({ stage: "code", email, error: message });
            }
          }
        })();
        return;
      }
    },
    [auth, otpHandle, heldIntent, replayHeldIntent, session],
  );

  const submit = useCallback(
    (value: string) => {
      if (auth && auth.stage !== "done") {
        submitAuth(value);
        return;
      }

      const text = sanitizeInput(value);
      if (!text) return;
      setDraft("");
      setPending(text);
      setFallbackActive(false);

      void (async () => {
        try {
          const intent = await parseIntent(text, {
            session: session.get(),
            fallback,
            pending: clarification ?? undefined,
          });

          if (WALLET_INTENTS.has(intent.intent) && !walletService) {
            setHeldIntent({ text, intent });
            setAuth({ stage: "email" });
            return;
          }

          const run = await executeParsed(intent, session.get(), {
            tools: undefined,
            walletService: walletService ?? undefined,
          });
          finishTurn(text, run);
        } catch (e) {
          recordTurnError(text, errorMessage(e));
        } finally {
          setFallbackActive(false);
          setPending(null);
        }
      })();
    },
    [
      auth,
      clarification,
      fallback,
      finishTurn,
      recordTurnError,
      session,
      submitAuth,
      walletService,
    ],
  );

  return {
    snapshot,
    turns,
    draft,
    pending,
    fallbackActive,
    fallbackProvider,
    auth,
    setDraft,
    submit,
  };
}
