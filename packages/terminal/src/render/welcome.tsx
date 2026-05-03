import { Box, Text } from "ink";
import React from "react";
import { palette, symbols } from "../theme/index.js";

const EXAMPLES: readonly string[] = [
  "create my zuno wallet",
  "show my zuno wallet",
  "inspect my positions",
  "recommend what I should do",
];

const WORDMARK = ["▀▀▀█ █  █ █▄ █ █▀▀█", " ▄▀  █  █ █▀██ █  █", "▀▀▀▀ ▀▀▀▀ ▀  ▀ ▀▀▀▀"] as const;

function Wordmark(): React.ReactElement {
  return (
    <Box flexDirection="column" marginLeft={2}>
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
        <Text color={palette.muted}>{`${version} · turnkey-backed uniswap lp operator`}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={palette.muted}> try</Text>
        {EXAMPLES.map((example) => (
          <Box key={example}>
            <Text color={palette.faint}>{`   ${symbols.prompt} `}</Text>
            <Text color={palette.fgDim}>{example}</Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text
          color={palette.faint}
        >{`  type ${symbols.prompt} exit  to quit  ·  ctrl+c also works`}</Text>
      </Box>
    </Box>
  );
}
