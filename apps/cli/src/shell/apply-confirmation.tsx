import type { ApplyPlanData, ToolExecutionResult } from "@zuno/runtime";
import { palette, symbols } from "@zuno/ui-terminal";
import { Box, Text } from "ink";
import qrcode from "qrcode-terminal";
import React from "react";

const KEY_WIDTH = 14;
const HR = "─".repeat(56);

export interface ApplyConfirmationProps {
  result: ToolExecutionResult;
}

/**
 * Dedicated apply confirmation card. Bigger and more prominent than the
 * generic ResultPanel. This is the "stop and look" moment between plan
 * preparation and the wallet popup — the user sees the full picture in one
 * panel: position, range change, cost, residual, and the Risk verdict.
 */
export function ApplyConfirmation({ result }: ApplyConfirmationProps): React.ReactElement {
  if (result.status !== "success" || !result.data) {
    return <BlockedPanel result={result} />;
  }

  const data = result.data as ApplyPlanData;
  const qr = data.approval.uri ? terminalQr(data.approval.uri) : null;
  const verdictColor =
    data.verdict === "approve"
      ? palette.ok
      : data.verdict === "approve_with_caution"
        ? palette.warn
        : palette.bad;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={palette.muted}>{`  ${HR}`}</Text>
      <Box marginTop={1}>
        <Text color={palette.accent} bold>{`  ${symbols.diamond} apply plan `}</Text>
        <Text color={palette.fg} bold>
          {data.planId}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Section title="position" />
        <Row k="position" v={data.positionId} />
        <Row k="pair" v={`${data.pair}  ${(data.feeTier / 10_000).toFixed(2)}%`} />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Section title="range change" />
        <Row
          k="old"
          v={`${data.oldRange.priceLower.toFixed(2)} → ${data.oldRange.priceUpper.toFixed(2)}`}
          muted
        />
        <Row
          k="new"
          v={`${data.newRange.priceLower.toFixed(2)} → ${data.newRange.priceUpper.toFixed(2)}`}
          accent
        />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Section title="cost" />
        <Row k="gas" v={data.estimatedGas} />
        <Row k="slippage" v={`${(data.estimatedSlippage * 100).toFixed(2)}%`} />
        <Row k="residual" v={`${data.residual.token0} / ${data.residual.token1}`} />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Section title="risk review" />
        <Box>
          <Text color={palette.muted}>{`  ${"verdict".padEnd(KEY_WIDTH)}`}</Text>
          <Text color={verdictColor} bold>
            {data.verdict}
          </Text>
          <Text color={palette.muted}>{`   confidence `}</Text>
          <Text color={palette.fg}>{data.confidence.toFixed(2)}</Text>
        </Box>
        {data.reasons.map((reason, i) => (
          <Box key={`reason-${i}`}>
            <Text color={palette.muted}>{`  ${(i === 0 ? "reason" : "·").padEnd(KEY_WIDTH)}`}</Text>
            <Text color={palette.fgDim}>{reason}</Text>
          </Box>
        ))}
        {data.warnings.length > 0 ? (
          <Box flexDirection="column" marginTop={1}>
            {data.warnings.map((w, i) => (
              <Box key={`warn-${i}`}>
                <Text color={palette.warn}>{`  ${"warning".padEnd(KEY_WIDTH)}`}</Text>
                <Text color={palette.fgDim}>{w}</Text>
              </Box>
            ))}
          </Box>
        ) : null}
      </Box>

      <Box marginTop={1}>
        <Text color={palette.accent} bold>{`  ${symbols.prompt} `}</Text>
        <Text color={palette.fg} bold>
          {data.status === "requires_wallet_signature"
            ? "wallet approval required - scan the terminal QR when available"
            : data.summary}
        </Text>
      </Box>
      <Box flexDirection="column">
        <Row
          k="approval"
          v={approvalLabel(data.approval.status)}
          accent={data.approval.status === "ready"}
        />
        {data.approval.instructions.map((instruction, i) => (
          <Row key={`approval-${i}`} k={i === 0 ? "next" : "·"} v={instruction} muted />
        ))}
        {qr ? (
          <Box marginTop={1}>
            <Text color={palette.fg}>{qr}</Text>
          </Box>
        ) : null}
      </Box>
      <Text color={palette.muted}>{`  ${HR}`}</Text>
    </Box>
  );
}

function approvalLabel(status: ApplyPlanData["approval"]["status"]): string {
  if (status === "ready") return "WalletConnect QR ready";
  if (status === "requires_session") return "create WalletConnect session";
  return "set REOWN_PROJECT_ID for QR session";
}

function terminalQr(uri: string): string {
  let out = "";
  qrcode.generate(uri, { small: true }, (qr) => {
    out = qr;
  });
  return out.trimEnd();
}

function BlockedPanel({ result }: { result: ToolExecutionResult }): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={palette.muted}>{`  ${HR}`}</Text>
      <Box>
        <Text color={palette.bad} bold>{`  ✕ apply blocked`}</Text>
      </Box>
      <Row k="message" v={result.message} muted />
      {result.errorCode ? <Row k="code" v={result.errorCode} muted /> : null}
      <Text color={palette.muted}>{`  ${HR}`}</Text>
    </Box>
  );
}

function Section({ title }: { title: string }): React.ReactElement {
  return (
    <Box>
      <Text color={palette.accent}>{symbols.diamond}</Text>
      <Text color={palette.muted}>{` ${title}`}</Text>
    </Box>
  );
}

function Row({
  k,
  v,
  muted = false,
  accent = false,
}: {
  k: string;
  v: string;
  muted?: boolean;
  accent?: boolean;
}): React.ReactElement {
  return (
    <Box>
      <Text color={palette.muted}>{`  ${k.padEnd(KEY_WIDTH)}`}</Text>
      <Text color={accent ? palette.accent : muted ? palette.fgDim : palette.fg}>{v}</Text>
    </Box>
  );
}
