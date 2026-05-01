import { palette, symbols } from "@zuno/terminal";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import React from "react";
import type { AuthFlowState } from "../types/index.js";

export interface AuthFlowProps {
  state: AuthFlowState;
  draft: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

const HR = "─".repeat(56);

export function AuthFlow({ state, draft, onChange, onSubmit }: AuthFlowProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={palette.muted}>{`  ${HR}`}</Text>
      <Box marginTop={1}>
        <Text color={palette.accent} bold>{`  ${symbols.diamond} sign in to zuno`}</Text>
        <Text color={palette.faint}>{`   email · turnkey otp`}</Text>
      </Box>
      <Body state={state} draft={draft} onChange={onChange} onSubmit={onSubmit} />
      <Text color={palette.muted}>{`  ${HR}`}</Text>
    </Box>
  );
}

function Body({
  state,
  draft,
  onChange,
  onSubmit,
}: {
  state: AuthFlowState;
  draft: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}): React.ReactElement {
  switch (state.stage) {
    case "email":
      return (
        <Box flexDirection="column" marginTop={1}>
          <Prompt label="email" hint="we send a one-time code">
            <TextInput value={draft} onChange={onChange} onSubmit={onSubmit} />
          </Prompt>
          {state.error ? <ErrorLine message={state.error} /> : null}
        </Box>
      );
    case "sending":
      return <Status text={`sending code to ${state.email}…`} />;
    case "code":
      return (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={palette.muted}>{`  code sent to `}</Text>
            <Text color={palette.fg}>{state.email}</Text>
          </Box>
          <Prompt label="code" hint="paste from email, single use, ~5 min lifetime">
            <TextInput value={draft} onChange={onChange} onSubmit={onSubmit} />
          </Prompt>
          {state.error ? <ErrorLine message={state.error} /> : null}
        </Box>
      );
    case "verifying":
      return <Status text="verifying code, bootstrapping your sub-org…" />;
    case "done":
      return <Status text={`signed in as ${state.email}`} accent />;
    case "failed":
      return (
        <Box flexDirection="column" marginTop={1}>
          <ErrorLine message={state.error} />
          <Box>
            <Text color={palette.faint}>{`  retry  `}</Text>
            <Text color={palette.muted}>type your email again to start over</Text>
          </Box>
          <Prompt label="email" hint="we send a one-time code">
            <TextInput value={draft} onChange={onChange} onSubmit={onSubmit} />
          </Prompt>
        </Box>
      );
  }
}

function Prompt({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Box marginTop={1} flexDirection="column">
      <Box>
        <Text color={palette.faint}>{`  ${label.padEnd(8)}`}</Text>
        <Text color={palette.muted}>{hint}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={palette.accent}>{`  ${symbols.prompt} `}</Text>
        {children}
      </Box>
    </Box>
  );
}

function Status({ text, accent = false }: { text: string; accent?: boolean }): React.ReactElement {
  return (
    <Box marginTop={1}>
      <Text color={palette.accent}>{`  ${symbols.diamond} `}</Text>
      <Text color={accent ? palette.ok : palette.muted}>{text}</Text>
    </Box>
  );
}

function ErrorLine({ message }: { message: string }): React.ReactElement {
  return (
    <Box marginTop={1}>
      <Text color={palette.bad}>{`  ✕ `}</Text>
      <Text color={palette.fg}>{message}</Text>
    </Box>
  );
}
