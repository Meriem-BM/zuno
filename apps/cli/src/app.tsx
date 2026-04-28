import {
  EchoLine,
  IntentPanel,
  SessionPanel,
  Welcome,
  palette,
  symbols,
} from "@zuno/ui-terminal";
import { Box, Static, Text } from "ink";
import TextInput from "ink-text-input";
import React, { useMemo } from "react";
import { HelpPanel, ResultPanel } from "./shell/render-result.js";
import type { ScrollItem, Turn } from "./types.js";
import { useShell } from "./hooks/useShell.js";

export function App(): React.ReactElement {
  const { snapshot, turns, draft, setDraft, submit } = useShell();

  const scrollItems = useMemo<ScrollItem[]>(
    () => [
      { kind: "welcome", key: "welcome" },
      ...turns.map<ScrollItem>((turn) => ({
        kind: "turn",
        key: `turn-${turn.id}`,
        turn,
      })),
    ],
    [turns],
  );

  return (
    <Box flexDirection="column">
      <Static items={scrollItems}>
        {(item) =>
          item.kind === "welcome" ? (
            <Welcome key={item.key} />
          ) : (
            <TurnView key={item.key} turn={item.turn} />
          )
        }
      </Static>
      <SessionPanel state={snapshot} />
      <Box marginTop={1}>
        <Text color={palette.accent}>{symbols.prompt} </Text>
        <TextInput value={draft} onChange={setDraft} onSubmit={submit} />
      </Box>
    </Box>
  );
}

function TurnView({ turn }: { turn: Turn }): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <EchoLine text={turn.input} />
      <IntentPanel intent={turn.intent} />
      {turn.intent.intent === "help" ? <HelpPanel /> : null}
      {turn.result ? <ResultPanel result={turn.result} /> : null}
    </Box>
  );
}
