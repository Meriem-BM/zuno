import { EchoLine, Welcome, palette, symbols } from "@zuno/terminal";
import { Box, Static, Text } from "ink";
import TextInput from "ink-text-input";
import React, { useMemo } from "react";
import { useShell } from "./hooks/useShell.js";
import { ApplyConfirmation } from "./shell/apply-confirmation.js";
import { AuthFlow } from "./shell/auth-flow.js";
import { ClarificationPanel, HelpPanel, ResultPanel } from "./shell/panels.js";
import { WalletStatus } from "./shell/wallet-status.js";
import type { ScrollItem, Turn } from "./types/index.js";

export function App(): React.ReactElement {
  const {
    snapshot,
    turns,
    draft,
    pending,
    fallbackActive,
    fallbackProvider,
    auth,
    setDraft,
    submit,
  } = useShell();

  const scrollItems = useMemo<ScrollItem[]>(
    () => [
      { kind: "welcome", key: "welcome" },
      ...turns.map<ScrollItem>((turn) => ({
        kind: "turn",
        key: `turn-${turn.id}`,
        turn,
      })),
    ],
    [turns],
  );

  return (
    <Box flexDirection="column">
      <Static items={scrollItems}>
        {(item) =>
          item.kind === "welcome" ? (
            <Welcome key={item.key} />
          ) : (
            <TurnView key={item.key} turn={item.turn} />
          )
        }
      </Static>
      {auth ? (
        <AuthFlow state={auth} draft={draft} onChange={setDraft} onSubmit={submit} />
      ) : (
        <>
          {pending ? (
            <PendingLine
              text={pending}
              fallbackActive={fallbackActive}
              provider={fallbackProvider}
            />
          ) : null}
          <WalletStatus state={snapshot} />
          <Box marginTop={1}>
            <Text color={palette.accent}>{symbols.prompt} </Text>
            <TextInput value={draft} onChange={setDraft} onSubmit={submit} />
          </Box>
        </>
      )}
    </Box>
  );
}

function TurnView({ turn }: { turn: Turn }): React.ReactElement {
  const isApply = turn.intent.intent === "apply_plan" && turn.result;
  return (
    <Box flexDirection="column" marginTop={1}>
      <EchoLine text={turn.input} />
      {turn.intent.intent === "help" ? <HelpPanel /> : null}
      {turn.intent.intent === "needs_clarification" && turn.intent.clarification ? (
        <ClarificationPanel text={turn.intent.clarification} />
      ) : null}
      {isApply ? (
        <ApplyConfirmation result={turn.result!} />
      ) : turn.result ? (
        <ResultPanel result={turn.result} />
      ) : null}
    </Box>
  );
}

function PendingLine({
  text,
  fallbackActive,
  provider,
}: {
  text: string;
  fallbackActive: boolean;
  provider: string | null;
}): React.ReactElement {
  const message = fallbackActive ? aiFallbackMessage(provider) : pendingMessage(text);
  return (
    <Box marginTop={1}>
      <Text color={palette.accent}>{symbols.diamond}</Text>
      <Text color={palette.muted}>{` ${message}`}</Text>
    </Box>
  );
}

function aiFallbackMessage(provider: string | null): string {
  return provider ? `routing with ${provider}...` : "routing with intent model...";
}

function pendingMessage(text: string): string {
  if (/\bconnect\b.*\bwallet\b/iu.test(text)) return "checking read target...";
  if (/^\s*0x[a-f0-9]{40}\s*$/iu.test(text)) return "reading wallet positions...";
  if (/\b(show|list|my|analyze|analyse)\b.*\b(lp\s+)?(?:positions?|wallet|address)\b/iu.test(text))
    return "reading positions...";
  if (/\binspect|range|out of range|risky\b/iu.test(text)) return "checking position state...";
  if (/\brecommend|rebalance|what should\b/iu.test(text))
    return "asking watcher, planner, and risk...";
  if (/\b(create|open|mint|provide)\b.*\b(position|liquidity|range)\b/iu.test(text))
    return "asking scout, strategist, critic, and arbiter...";
  if (/\b(swap|trade|exchange|convert)\b/iu.test(text)) return "checking product boundary...";
  if (/\bdiff|simulate|apply\b/iu.test(text)) return "preparing plan preview...";
  if (/\bagent|peer|alert|watch|monitor\b/iu.test(text)) return "checking local services...";
  return "thinking...";
}
