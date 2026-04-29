import type { ToolExecutionResult } from "@zuno/runtime";
import { Row, palette, symbols, type Field } from "@zuno/ui-terminal";
import { Box, Text } from "ink";
import React from "react";
import { HELP_LINES } from "../ui/constants.js";
import { formatResultData } from "../ui/format.js";

export interface ResultPanelProps {
  result: ToolExecutionResult;
}

export function ResultPanel({ result }: ResultPanelProps): React.ReactElement {
  const isError = result.status === "error";
  const fields: Field[] = formatResultData(result);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={isError ? palette.bad : palette.ok}>{isError ? "✕" : "✓"}</Text>
        <Text color={isError ? palette.bad : palette.fg}>{` ${headline(result)}`}</Text>
      </Box>
      {fields.map((f) => (
        <Row key={f.key} field={f} />
      ))}
      {isError && result.errorCode ? (
        <Box>
          <Text color={palette.faint}>{`  code        ${result.errorCode}`}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

export function ClarificationPanel({ text }: { text: string }): React.ReactElement {
  return (
    <Box marginTop={1}>
      <Text color={palette.warn}>{symbols.diamond}</Text>
      <Text color={palette.fgDim}>{` ${text}`}</Text>
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

function headline(result: ToolExecutionResult): string {
  if (result.status === "error") return result.message;

  switch (result.tool) {
    case "connectWallet":
      return "wallet connected";
    case "listWalletPositions":
      return result.message;
    case "inspectPosition":
      return "position snapshot";
    case "checkRangeStatus":
      return result.message;
    case "listOutOfRangePositions":
    case "listRiskyPositions":
      return result.message;
    case "recommendRebalance":
      return "reviewed recommendation";
    case "showPlanDiff":
      return "plan diff";
    case "simulatePlan":
      return "simulation preview";
    case "applyPlan":
      return "wallet signing required";
    case "monitorWallet":
      return "monitor setup";
    case "showAlerts":
      return result.message;
    case "showAgentStatus":
      return "agent status";
    case "showPeers":
      return result.message;
    case "showLogs":
      return "recent activity";
    case "createPosition":
      return result.message;
    case "swapTokens":
      return result.message;
    default:
      return result.message;
  }
}
