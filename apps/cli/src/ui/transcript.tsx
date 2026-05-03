import type { AgentThought } from "@zuno/core";
import { palette } from "@zuno/terminal";
import { Box, Text } from "ink";
import React from "react";

const ROLE_COLORS: Record<AgentThought["role"], string> = {
  scout: palette.accent,
  strategist: palette.warn,
  critic: palette.bad,
  arbiter: palette.ok,
};

const ROLE_PAD = 11;

export function LiveTranscript({ thoughts }: { thoughts: AgentThought[] }): React.ReactElement | null {
  if (thoughts.length === 0) return null;
  return (
    <Box flexDirection="column" marginTop={0} marginLeft={2}>
      {thoughts.map((t, i) => (
        <Box key={i}>
          <Text color={ROLE_COLORS[t.role]}>{t.role.padEnd(ROLE_PAD)}</Text>
          <Text color={palette.fgDim}>{t.text}</Text>
        </Box>
      ))}
    </Box>
  );
}
