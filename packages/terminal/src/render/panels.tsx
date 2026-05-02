import type { SessionState } from "@zuno/core";
import type { Intent } from "@zuno/strategy/intents";
import { Box, Text } from "ink";
import React from "react";
import { palette, symbols } from "../theme/index.js";

export interface Field {
  key: string;
  value: string;
}

const KEY_WIDTH = 12;

export function Row({ field }: { field: Field }): React.ReactElement {
  return (
    <Box>
      <Text color={palette.muted}>{`  ${field.key.padEnd(KEY_WIDTH)}`}</Text>
      <Text color={palette.fg}>{field.value}</Text>
    </Box>
  );
}

function intentFields(intent: Intent): Field[] {
  const fields: Field[] = [
    { key: "intent", value: intent.intent },
    { key: "confidence", value: intent.confidence.toFixed(2) },
  ];
  if (intent.positionId) fields.push({ key: "positionId", value: intent.positionId });
  if (intent.planId) fields.push({ key: "planId", value: intent.planId });
  if (intent.amount && intent.tokenSymbol) {
    fields.push({ key: "amount", value: `${intent.amount} ${intent.tokenSymbol}` });
  }
  return fields;
}

export interface IntentPanelProps {
  intent: Intent;
}

export function IntentPanel({ intent }: IntentPanelProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={palette.accent}>{symbols.diamond}</Text>
        <Text color={palette.muted}> parsed</Text>
      </Box>
      {intentFields(intent).map((field) => (
        <Row key={field.key} field={field} />
      ))}
      {intent.clarification ? (
        <Box marginTop={1}>
          <Text color={palette.accent}>{`  ${symbols.prompt} `}</Text>
          <Text color={palette.fg}>{intent.clarification}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function sessionFields(state: SessionState): Field[] {
  const fmt = (value: string | number | null): string =>
    value === null || value === undefined ? "-" : String(value);
  return [
    { key: "zuno", value: fmt(state.agentWalletAddress) },
    { key: "approval", value: fmt(state.approvalState) },
    { key: "execution", value: fmt(state.executionState) },
    { key: "position", value: fmt(state.lastPositionId) },
    { key: "plan", value: fmt(state.lastPlanId) },
  ];
}

export interface SessionPanelProps {
  state: SessionState;
}

export function SessionPanel({ state }: SessionPanelProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={palette.accent}>{symbols.diamond}</Text>
        <Text color={palette.muted}> session</Text>
      </Box>
      {sessionFields(state).map((field) => (
        <Row key={field.key} field={field} />
      ))}
    </Box>
  );
}

export interface EchoLineProps {
  text: string;
}

export function EchoLine({ text }: EchoLineProps): React.ReactElement {
  return (
    <Box>
      <Text color={palette.accent}>{symbols.prompt} </Text>
      <Text color={palette.fg}>{text}</Text>
    </Box>
  );
}
