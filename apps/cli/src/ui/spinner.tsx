import { palette } from "@zuno/terminal";
import { Box, Text } from "ink";
import React, { useEffect, useRef, useState } from "react";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const FRAME_INTERVAL_MS = 80;

export function Spinner({ label }: { label: string }): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const frameTick = setInterval(
      () => setFrame((f) => (f + 1) % FRAMES.length),
      FRAME_INTERVAL_MS,
    );
    const secondTick = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => {
      clearInterval(frameTick);
      clearInterval(secondTick);
    };
  }, []);

  return (
    <Box marginTop={1}>
      <Text color={palette.accent}>{FRAMES[frame]}</Text>
      <Text color={palette.muted}>{` ${label}`}</Text>
      {elapsed > 0 ? <Text color={palette.faint}>{`  (${elapsed}s)`}</Text> : null}
    </Box>
  );
}
