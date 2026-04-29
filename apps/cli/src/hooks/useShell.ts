import { createSession, type SessionState } from "@zuno/core";
import { createModelFallback, type PendingClarification } from "@zuno/intents";
import type { ApplyPlanData } from "@zuno/runtime";
import { useApp, useInput } from "ink";
import { useCallback, useMemo, useState } from "react";
import type { MonitorPreviewState } from "../shell/monitor-teaser.js";
import { pendingFromIntent, runIntent } from "../shell/run-intent.js";
import type { Turn } from "../shell/types.js";

const MONITOR_TEASER_DELAY_MS = 2500;

export interface Shell {
  snapshot: SessionState;
  turns: Turn[];
  draft: string;
  pending: string | null;
  fallbackActive: boolean;
  fallbackProvider: string | null;
  monitorPreview: MonitorPreviewState | null;
  setDraft: (value: string) => void;
  submit: (value: string) => void;
}

/**
 * Single source of truth for the interactive shell:
 * session state, turn history, draft buffer, submit pipeline,
 * and Escape-to-exit. The App component just composes the result.
 *
 * Per turn: parse → if shell-level (handled here), exit/render; otherwise the
 * runtime executes and returns the new session, which we adopt verbatim. While
 * a turn is in flight, `pending` carries the user's input so the UI can render
 * a "working…" indicator. Any thrown error from parser or runtime surfaces as
 * an error turn — the shell itself never crashes.
 *
 * After a successful apply, a monitor teaser is armed 2.5s later as a
 * Phase-2 preview. It's cleared the moment the user submits the next input.
 */
export function useShell(): Shell {
  const { exit } = useApp();
  const session = useMemo(() => createSession(), []);

  const [snapshot, setSnapshot] = useState<SessionState>(() => session.get());
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [fallbackActive, setFallbackActive] = useState(false);
  const [clarification, setClarification] = useState<PendingClarification | null>(null);
  const [monitorPreview, setMonitorPreview] = useState<MonitorPreviewState | null>(null);
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

  useInput((_, key) => {
    if (key.escape) exit();
  });

  const submit = useCallback(
    (value: string) => {
      const text = sanitizeInput(value);
      if (!text) return;
      setDraft("");
      setPending(text);
      setFallbackActive(false);
      // Clear any prior monitor teaser the moment a new turn starts.
      setMonitorPreview(null);

      void (async () => {
        try {
          const run = await runIntent(text, session.get(), {
            fallback,
            pending: clarification ?? undefined,
          });
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

          // Apply success → arm the Phase-2 monitor teaser shortly after.
          if (
            run.intent.intent === "apply_plan" &&
            run.result?.status === "success" &&
            run.result.tool === "applyPlan"
          ) {
            const data = run.result.data as ApplyPlanData;
            setTimeout(() => {
              setMonitorPreview({
                planId: data.planId,
                positionId: data.positionId,
                pair: data.pair,
                armedAt: Date.now(),
              });
            }, MONITOR_TEASER_DELAY_MS);
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
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
        } finally {
          setFallbackActive(false);
          setPending(null);
        }
      })();
    },
    [clarification, exit, fallback, session],
  );

  return {
    snapshot,
    turns,
    draft,
    pending,
    fallbackActive,
    fallbackProvider,
    monitorPreview,
    setDraft,
    submit,
  };
}

function configuredFallbackProvider(): string | null {
  const provider = process.env.ZUNO_INTENT_PROVIDER?.trim().toLowerCase();
  if (provider === "groq") return "Groq";
  if (provider === "openai") return "OpenAI";
  if (process.env.OPENAI_API_KEY) return "OpenAI";
  if (process.env.GROQ_API_KEY) return "Groq";
  return null;
}

function sanitizeInput(value: string): string {
  const esc = "\\u001B";
  const bel = "\\u0007";
  return value
    .replace(new RegExp(`${esc}\\[(?:200|201)~`, "gu"), "")
    .replace(new RegExp(`${esc}\\[[0-?]*[ -/]*[@-~]`, "gu"), "")
    .replace(new RegExp(`${esc}\\][^${bel}]*(?:${bel}|${esc}\\\\)`, "gu"), "")
    .trim();
}
