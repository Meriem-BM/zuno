import type { SessionState } from "@zuno/core";
import { chainNameFor, shortAddr } from "@zuno/wallet";
import { palette, symbols } from "@zuno/ui-terminal";
import { Box, Text } from "ink";
import React from "react";

export interface WalletStatusProps {
  state: SessionState;
}

/**
 * Compact status line above the prompt. This is intentionally not part of the
 * scrollback; it gives operator context without repeating a full session panel.
 */
export function WalletStatus({ state }: WalletStatusProps): React.ReactElement {
  if (!state.watchAddress && !state.walletAddress) {
    return <StatusLine parts={["read-only", "paste wallet address"]} />;
  }

  const chain = state.chainId ? chainNameFor(state.chainId) : "—";
  const parts = [];
  if (state.watchAddress) parts.push(`watch ${shortAddr(state.watchAddress)} on ${chain}`);
  if (state.walletAddress) parts.push(`exec ${shortAddr(state.walletAddress)}`);
  if (!state.watchAddress && state.walletAddress)
    parts.push(`watch ${shortAddr(state.walletAddress)} on ${chain}`);
  if (state.lastPositionId) parts.push(`position ${state.lastPositionId}`);
  if (state.lastPlanId) parts.push(`plan ${state.lastPlanId}`);

  return <StatusLine parts={parts} />;
}

function StatusLine({ parts }: { parts: string[] }): React.ReactElement {
  return (
    <Box marginTop={1}>
      <Text color={palette.faint}>{symbols.diamond} </Text>
      {parts.map((part, index) => (
        <React.Fragment key={part}>
          {index > 0 ? <Text color={palette.faint}> · </Text> : null}
          <Text color={index === 0 ? palette.fgDim : palette.muted}>{part}</Text>
        </React.Fragment>
      ))}
    </Box>
  );
}
