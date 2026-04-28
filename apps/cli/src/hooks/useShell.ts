import { createSession, type SessionState } from "@zuno/core";
import { createModelFallback } from "@zuno/intents";
import { useApp, useInput } from "ink";
import { useCallback, useMemo, useState } from "react";
import { runIntent } from "../shell/run-intent.js";
import type { Turn } from "../types.js";

export interface Shell {
  snapshot: SessionState;
  turns: Turn[];
  draft: string;
  setDraft: (value: string) => void;
  submit: (value: string) => void;
}

/**
 * Single source of truth for the interactive shell:
 * session state, turn history, draft buffer, submit pipeline,
 * and Escape-to-exit. The App component just composes the result.
 *
 * Per turn: parse → if shell-level (handled here), exit/render; otherwise the
 * runtime executes and returns the new session, which we adopt verbatim.
 */
export function useShell(): Shell {
  const { exit } = useApp();
  const session = useMemo(() => createSession(), []);
  const fallback = useMemo(() => createModelFallback(), []);

  const [snapshot, setSnapshot] = useState<SessionState>(() => session.get());
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");

  useInput((_, key) => {
    if (key.escape) exit();
  });

  const submit = useCallback(
    (value: string) => {
      const text = value.trim();
      if (!text) return;
      setDraft("");

      void (async () => {
        const run = await runIntent(text, session.get(), fallback);
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
      })();
    },
    [exit, fallback, session],
  );

  return { snapshot, turns, draft, setDraft, submit };
}
