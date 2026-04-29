import { AxlClient, type AxlFeedEvent } from "@zuno/axl";
import { palette, symbols } from "@zuno/ui-terminal";
import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

interface MeshTrace {
  key: string;
  from: string;
  to: string;
  kind: string;
}

const MAX_TRACES = 6;

export function MeshPanel(): React.ReactElement | null {
  const [traces, setTraces] = useState<MeshTrace[]>([]);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      try {
        const client = new AxlClient({ role: "cli" });
        const topology = await client.topology();
        if (cancelled) return;
        setOnline(true);

        unsubscribe = client.subscribeFeed((event: AxlFeedEvent) => {
          if (cancelled) return;
          setTraces((prev) => {
            const next: MeshTrace[] = [
              ...prev,
              {
                key: `${event.envelope.requestId}-${event.envelope.kind}-${event.observedAt}-${prev.length}`,
                from: event.envelope.from,
                to: event.toRole,
                kind: event.envelope.kind,
              },
            ];
            return next.slice(-MAX_TRACES);
          });
        });

        if (topology.peers.length === 0) setOnline(false);
      } catch {
        if (!cancelled) setOnline(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  if (traces.length === 0) return null;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={palette.accent}>{symbols.diamond}</Text>
        <Text color={palette.muted}> mesh</Text>
        {!online ? <Text color={palette.faint}>{`  · offline`}</Text> : null}
      </Box>
      {traces.map((trace) => (
        <Box key={trace.key}>
          <Text color={palette.muted}>{`  ${trace.from.padEnd(7)}`}</Text>
          <Text color={palette.faint}>{` -> `}</Text>
          <Text color={palette.muted}>{trace.to.padEnd(7)}</Text>
          <Text color={palette.fgDim}>{`  ${trace.kind}`}</Text>
        </Box>
      ))}
    </Box>
  );
}
