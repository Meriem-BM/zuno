import { Box, Text } from "ink";
import React from "react";
import { palette, symbols } from "./theme.js";

const EXAMPLES: readonly string[] = [
  "show my positions",
  "inspect position pos_4f2a3b",
  "recommend what I should do with this position",
];

const WORDMARK = [
  "▀▀▀█ █  █ █▄ █ █▀▀█",
  " ▄▀  █  █ █▀██ █  █",
  "▀▀▀▀ ▀▀▀▀ ▀  ▀ ▀▀▀▀",
] as const;

function Wordmark(): React.ReactElement {
  return (
    <Box flexDirection="column">
      {WORDMARK.map((row, idx) => (
        <Text key={idx} color={palette.accent}>
          {row}
        </Text>
      ))}
    </Box>
  );
}

export interface WelcomeProps {
  version?: string;
}

export function Welcome({ version = "v0.1" }: WelcomeProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1}>
      <Wordmark />
      <Box marginTop={1}>
        <Text color={palette.accent}>{symbols.diamond}</Text>
        <Text color={palette.fg}> zuno </Text>
        <Text color={palette.muted}>{`${version} · terminal-native uniswap lp copilot`}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={palette.muted}>  try</Text>
        {EXAMPLES.map((example) => (
          <Box key={example}>
            <Text color={palette.faint}>{`   ${symbols.prompt} `}</Text>
            <Text color={palette.fgDim}>{example}</Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={palette.faint}>{`  type ${symbols.prompt} exit  to quit  ·  ctrl+c also works`}</Text>
      </Box>
    </Box>
  );
}
