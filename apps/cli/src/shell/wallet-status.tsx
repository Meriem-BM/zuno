import type { SessionState } from "@zuno/core";
import { chainNameFor, shortAddr } from "@zuno/chain/wallet";
import { palette, symbols } from "@zuno/terminal";
import { Box, Text } from "ink";
import React from "react";

export interface WalletStatusProps {
  state: SessionState;
}

export function WalletStatus({ state }: WalletStatusProps): React.ReactElement {
  if (!state.agentWalletAddress) {
    return <StatusLine parts={["zuno wallet missing", "create my zuno wallet"]} />;
  }

  const chain = state.chainId ? chainNameFor(state.chainId) : "—";
  const parts = [`zuno ${shortAddr(state.agentWalletAddress)} on ${chain}`];
  if (state.approvalState) parts.push(`approval ${state.approvalState}`);
  if (state.executionState) parts.push(`execution ${state.executionState}`);
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
