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
import type { ScrollItem } from "./types.js";
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
            <Box key={item.key} flexDirection="column" marginTop={1}>
              <EchoLine text={item.turn.input} />
              <IntentPanel intent={item.turn.intent} />
            </Box>
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
