import type { SessionState } from "@zuno/core";
import type { Intent } from "@zuno/intents";
import { Box, Text } from "ink";
import React from "react";
import { palette, symbols } from "./theme.js";

interface Field {
  key: string;
  value: string;
}

const KEY_WIDTH = 12;

function Row({ field }: { field: Field }): React.ReactElement {
  return (
    <Box>
      <Text color={palette.muted}>{`  ${field.key.padEnd(KEY_WIDTH)}`}</Text>
      <Text color={palette.fg}>{field.value}</Text>
    </Box>
  );
}

function intentFields(intent: Intent): Field[] {
  const fields: Field[] = [{ key: "intent", value: intent.intent }];
  if (intent.positionId) fields.push({ key: "positionId", value: intent.positionId });
  if (intent.planId) fields.push({ key: "planId", value: intent.planId });
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
    </Box>
  );
}

function sessionFields(state: SessionState): Field[] {
  const fmt = (value: string | number | null): string =>
    value === null || value === undefined ? "—" : String(value);
  return [
    { key: "wallet", value: fmt(state.walletAddress) },
    { key: "chain", value: fmt(state.chainId) },
    { key: "position", value: fmt(state.lastPositionId) },
    { key: "plan", value: fmt(state.lastPlanId) },
    { key: "intent", value: fmt(state.lastIntent) },
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
