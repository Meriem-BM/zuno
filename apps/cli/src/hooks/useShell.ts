import { createSession, type SessionState } from "@zuno/core";
import { parseIntent, type Intent } from "@zuno/intents";
import { useApp, useInput } from "ink";
import { useCallback, useMemo, useState } from "react";
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
 */
export function useShell(): Shell {
  const { exit } = useApp();
  const session = useMemo(() => createSession(), []);

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

      const intent: Intent = parseIntent(text);
      if (intent.intent === "exit") {
        exit();
        return;
      }

      const next = session.update({
        lastIntent: intent.intent,
        ...(intent.positionId ? { lastPositionId: intent.positionId } : null),
        ...(intent.planId ? { lastPlanId: intent.planId } : null),
      });

      setSnapshot(next);
      setTurns((prev) => [...prev, { id: prev.length, input: text, intent }]);
      setDraft("");
    },
    [exit, session],
  );

  return { snapshot, turns, draft, setDraft, submit };
}
