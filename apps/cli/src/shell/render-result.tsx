import type { ToolExecutionResult } from "@zuno/runtime";
import { Field, Row, palette, symbols } from "@zuno/ui-terminal";
import { Box, Text } from "ink";
import React from "react";
import { HELP_LINES } from "../ui/constants.js";
import { formatResultData } from "../ui/format.js";

export interface ResultPanelProps {
  result: ToolExecutionResult;
}

/**
 * Render a runtime tool result. Headline shows status + tool name + message;
 * the body picks structured fields per tool. Errors get the same shape with
 * the error code surfaced.
 */
export function ResultPanel({ result }: ResultPanelProps): React.ReactElement {
  const isError = result.status === "error";
  const fields: Field[] = [];
  if (isError && result.errorCode) {
    fields.push({ key: "code", value: result.errorCode });
  }
  fields.push(...formatResultData(result));

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={isError ? palette.bad : palette.ok}>
          {isError ? "✕" : "✓"}
        </Text>
        <Text color={palette.muted}>{` ${result.tool}`}</Text>
      </Box>
      <Row field={{ key: "message", value: result.message }} />
      {fields.map((f) => (
        <Row key={f.key} field={f} />
      ))}
    </Box>
  );
}

export function HelpPanel(): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={palette.accent}>{symbols.diamond}</Text>
        <Text color={palette.muted}> commands</Text>
      </Box>
      {HELP_LINES.map((line) => (
        <Box key={line}>
          <Text color={palette.faint}>{`  ${symbols.prompt} `}</Text>
          <Text color={palette.fgDim}>{line}</Text>
        </Box>
      ))}
    </Box>
  );
}
