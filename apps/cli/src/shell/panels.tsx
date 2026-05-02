import type { ToolExecutionResult } from "@zuno/runtime";
import { Row, palette, symbols, type Field } from "@zuno/terminal";
import { Box, Text } from "ink";
import React from "react";
import { HELP_LINES } from "../lib/constants.js";
import { formatResultData } from "../ui/format.js";

interface ResultPanelProps {
  result: ToolExecutionResult;
}

export function ResultPanel({ result }: ResultPanelProps): React.ReactElement {
  const isError = result.status === "error";
  const isPending = result.status === "needs_confirmation";
  const fields: Field[] = formatResultData(result);
  const glyph = isError ? "✕" : isPending ? "?" : "✓";
  const glyphColor = isError ? palette.bad : isPending ? palette.warn : palette.ok;
  const labelColor = isError ? palette.bad : palette.fg;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={glyphColor}>{glyph}</Text>
        <Text color={labelColor}>{` ${headline(result)}`}</Text>
      </Box>
      {fields.map((f, i) => (
        <Row key={`${f.key}-${i}`} field={f} />
      ))}
      {isError && result.errorCode ? (
        <Box>
          <Text color={palette.faint}>{`  code        ${result.errorCode}`}</Text>
        </Box>
      ) : null}
      {isPending ? (
        <Box marginTop={1}>
          <Text color={palette.warn}>{`  ${symbols.diamond} `}</Text>
          <Text color={palette.fgDim}>{confirmPrompt(result)}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function confirmPrompt(result: ToolExecutionResult): string {
  const data = result.data as { prompt?: string } | undefined;
  return data?.prompt ?? 'Type "approve it" to confirm.';
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
    case "createAgentWallet":
      return "zuno wallet ready";
    case "showAgentWallet":
      return "zuno wallet";
    case "showAgentWalletBalance":
      return "zuno wallet balance";
    case "showBalances":
      return result.message;
    case "showNetwork":
      return result.message;
    case "switchNetwork":
      return result.message;
    case "showAllowances":
      return result.message;
    case "prepareSwap":
    case "showQuote":
      return "swap quote";
    case "approveToken":
      return "approve token";
    case "fundAgentWallet":
      return "fund zuno wallet";
    case "listAgentWalletPositions":
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
    case "approvePlan":
      return "plan approved";
    case "applyPlan":
      return "turnkey execution";
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
