import { palette, symbols } from "@zuno/ui-terminal";
import { Box, Text } from "ink";
import React from "react";

export interface MonitorPreviewState {
  planId: string;
  positionId: string;
  pair: string;
  armedAt: number;
}

export interface MonitorTeaserProps {
  preview: MonitorPreviewState | null;
}

const SOFT_HR = "·".repeat(56);

/**
 * "What comes next" teaser shown after a successful apply. Notification-style
 * card that hints at the Phase 2 monitor — Zuno watching the position 24/7
 * and pinging when it drifts again. Labelled as a preview so it doesn't
 * over-promise: the always-on monitor isn't shipped yet.
 */
export function MonitorTeaser({ preview }: MonitorTeaserProps): React.ReactElement | null {
  if (!preview) return null;
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={palette.faint}>{`  ${SOFT_HR}`}</Text>
      <Box marginTop={1}>
        <Text color={palette.accent}>{`  ${symbols.diamond}`}</Text>
        <Text color={palette.fg} bold>{` zuno monitor armed`}</Text>
        <Text color={palette.faint}>{`   preview · phase 2`}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={palette.muted}>{`  watching  `}</Text>
        <Text color={palette.fg}>{preview.positionId}</Text>
        <Text color={palette.muted}>{`  ·  `}</Text>
        <Text color={palette.fgDim}>{preview.pair}</Text>
      </Box>
      <Box>
        <Text color={palette.muted}>{`  trigger   `}</Text>
        <Text color={palette.fgDim}>
          drifts out of range, fee yield drops sharply, or vol spikes
        </Text>
      </Box>
      <Box>
        <Text color={palette.muted}>{`  delivery  `}</Text>
        <Text color={palette.fgDim}>
          reviewed plan ready to apply, pinged via your channel of choice
        </Text>
      </Box>
    </Box>
  );
}
