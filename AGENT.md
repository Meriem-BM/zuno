# AGENT.md

## What we are building

Zuno is a terminal-native Uniswap LP copilot.

A user runs:

- `zuno`

Then types plain English inside the shell, for example:

- create my zuno wallet
- inspect my positions
- inspect position 42
- recommend what I should do with this position
- show me the diff
- simulate it
- approve it
- apply it

Zuno is not a generic wallet chatbot.
It is a focused LP workflow tool.

## Product goals

Zuno should help a liquidity provider answer:

- what positions do I have
- which positions are out of range
- what does this position look like right now
- what rebalance should I consider
- what changes if I apply that rebalance
- can I simulate it before signing

## Core interaction model

1. User launches `zuno`
2. User types plain English
3. Intent parser maps text to a structured intent
4. Direct tools handle deterministic reads and plan review
5. AXL agents handle recommendation tasks
6. Zuno renders concise, structured output
7. User explicitly approves before Turnkey signs from the Zuno wallet

## Intents to support

### Wallet

- create my zuno wallet
- show my zuno wallet
- fund my zuno wallet
- show zuno wallet balance
- inspect my positions

### Position reads

- inspect a position
- inspect all positions
- check range status
- list out-of-range positions
- list risky positions

### Recommendation

- recommend a rebalance
- show rebalance options
- explain why a recommendation was chosen

### Plan review and execution

- show the diff
- simulate the plan
- apply the plan

### Agent/network

- show agent status
- show peers
- show logs

## Which tasks use AXL

Use AXL only for recommendation-style flows and agent health visibility.

Use AXL for:

- recommend rebalance
- show rebalance options
- agent status
- peers / agent visibility

Do not use AXL for:

- wallet balance
- listing positions
- inspecting positions
- range checks
- showing a saved diff
- basic simulation
- direct transaction signing

## Agent roles

### Watcher

Responsible for:

- reading LP position state
- reading pool state
- reading price/tick/range context
- producing structured position state

### Planner

Responsible for:

- generating 1-2 rebalance candidates
- producing structured candidate output
- keeping candidate generation concise and deterministic where possible

### Risk

Responsible for:

- critiquing proposed candidates
- rejecting weak or overly risky plans
- selecting the final winner
- producing a short reason the user can understand

## AXL flow

Recommendation flow:

1. CLI receives recommendation intent
2. CLI sends request to Watcher
3. Watcher gathers position + pool state
4. Watcher sends structured state over AXL to Planner
5. Planner creates candidates
6. Planner sends candidates over AXL to Risk
7. Risk critiques candidates and selects a winner
8. Risk sends final result back through AXL
9. CLI stores the plan and renders the recommendation

Simple message chain:

CLI -> Watcher -> Planner -> Risk -> CLI

## Tooling model

The model should not directly manipulate chain state.
Use tools.

### Direct deterministic tools

- wallet session tools
- wallet balance tools
- position fetch tools
- pool state tools
- range status tools
- risk-scoring helpers
- diff renderer
- simulation builder
- transaction builder

### Agent tools

- send request to Watcher
- send state to Planner
- send candidates to Risk
- ping peers / inspect agent status

## Session state

Keep a small session memory in the shell:

- wallet address
- current chain
- last inspected position
- last generated plan
- signer mode
- last intent

This allows references like:

- this position
- that plan
- apply it
- show me the diff

## Persistence

Default to minimal local state.
Store only what is necessary:

- latest plan
- recent plan history
- request ids
- non-sensitive logs

Do not store:

- seed phrases
- raw private keys
- unnecessary personal data

## Wallet safety rules

- The terminal must not own the user's key by default.
- The personal wallet signs transactions in a wallet UI.
- Every state-changing transaction requires explicit user confirmation.
- Enclave signing is a separate mode.
- Enclave execution only works when onchain authority exists.

## Guardrails

- Never invent balances, fees, or prices.
- Never fabricate a position id.
- Never silently execute a transaction.
- Never treat a recommendation as guaranteed profit.
- Never hide uncertainty when data is incomplete.
- Never bypass onchain ownership rules.

## Coding expectations

- deterministic logic for anything financial
- clean boundaries between packages
- typed message contracts
- structured errors
- testable modules
- no bloated abstractions
- no stale package versions
- no deprecated patterns if a stable modern replacement exists

## File layout rules

For any source file beyond a thin entry point, do not pile constants, types, helpers, and the main implementation into one file. Split them out as soon as the file has more than the main implementation:

- **Constants** live in their own `constants.ts`. Always extract — even one shared constant goes here.
- **Types** live in their own `types.ts` when there are two or more, or when a type is referenced from another file. A single type used only in its own file can stay inline.
- **Helper / pure functions** live in their own `helpers.ts`. The main file should contain the public surface (the route handlers, the React component, the hook body, the executor) — not the small pure utilities they call.
- **Main file** contains the public surface only. It imports from `constants.ts`, `types.ts`, `helpers.ts`.

Group these next to the main file (`apps/<app>/src/`, `packages/<pkg>/src/`, or in a `lib/` folder when the constants/helpers are reused across siblings inside the same app/package). Do not invent prefix-style names like `useShell-helpers.ts` or `proxy-types.ts` — use plain `helpers.ts` / `types.ts` / `constants.ts` next to or in `lib/`.

This rule applies to every new file in this repo. If you find yourself writing inline `const FOO = …`, `interface Bar {…}`, and `function helper() {}` blocks above the public surface in the same file, move them out before finishing the change.

## Design expectations

CLI:

- minimal
- premium
- readable
- lightly branded
- not noisy

Landing page:

- minimalist
- restrained
- technical
- one clear pitch
- no clutter

## Quality bar

Code should be:

- clean
- modular
- scalable
- easy to reason about
- easy to test
- production-minded
- top-grade, not hacky

## Git workflow

### Branch naming

Use short, descriptive branch names with these prefixes:

- `feat/`
- `fix/`
- `refactor/`
- `docs/`
- `chore/`
- `test/`

Examples:

- `feat/interactive-shell`
- `feat/ui-terminal-header`
- `fix/wallet-session-timeout`
- `refactor/intent-router`
- `docs/setup-guide`

### Commit message standard

Use lowercase, one-line, conventional-style commit messages.

Format:

- `feat(scope): message`
- `fix(scope): message`
- `refactor(scope): message`
- `docs(scope): message`
- `chore(scope): message`
- `test(scope): message`

Rules:

- use imperative mood
- keep it concise
- do not end with a period
- keep the subject line focused on one change
- prefer a clear scope when useful

Examples:

- `feat(ui): add zuno welcome header`
- `feat(uniswap): add position range status helper`
- `fix(wallet): prevent stale signer session reuse`
- `refactor(intents): simplify position reference resolution`
- `docs(readme): add local signer setup`
- `test(planner): cover candidate veto rules`

### Pull request requirements

Every PR should:

- pass CI
- pass typecheck
- pass lint
- pass tests
- keep documentation in sync when architecture or setup changes

Any PR touching these areas requires extra review:

- signer flows
- agent wallet lifecycle
- execution pipeline
- policy logic
- risk logic
- protocol adapters
- AXL transport
- anything that can affect security or fund movement

### Review expectations

Before merging:

- confirm the change matches the intended package boundary
- confirm no sensitive wallet data is stored
- confirm financial logic remains deterministic
- confirm no hidden execution path was introduced
- confirm naming and public interfaces stay clear and minimal

## Definition of done

A task is done only when:

- the feature works end to end for its intended path
- typecheck passes
- lint passes
- relevant tests are added or updated
- docs are updated when setup, architecture, or behavior changed
- no obvious dead code or debug leftovers remain
- no known security regression was introduced
- public interfaces are named clearly and intentionally

## Dependency rules

- Prefer existing repo packages before adding a new dependency.
- Add a new dependency only with a clear reason.
- Avoid overlapping libraries that solve the same problem.
- Prefer small, maintained, stable packages.
- Remove unused dependencies quickly.
- Do not add heavy frameworks for narrow problems.
- Do not add a package when a small local utility is enough.

## File and module rules

- Avoid large multi-purpose files.
- Split a module when responsibilities start to diverge.
- Keep public module APIs small and explicit.
- Prefer one clear responsibility per file.
- Avoid circular dependencies.
- Keep app entrypoints thin and orchestration-focused.
- Keep shared domain logic out of UI and transport layers.

## Logging rules

- Use structured logs where possible.
- Include request ids and plan ids in multi-step flows.
- Never log secrets, private keys, seed phrases, or sensitive session tokens.
- Never log full signed payloads if not necessary.
- Keep debug logging easy to disable.
- Log enough context to debug agent flows without leaking sensitive data.

## Environment and config rules

- Validate environment variables at startup.
- Document every required environment variable.
- Fail early on missing or invalid configuration.
- Do not read undeclared environment variables deep inside business logic.
- Keep configuration centralized.
- Separate dev/test/prod config clearly.
- Do not hardcode secrets, RPC URLs, or signer credentials.

## Inter-agent message contract rules

- All AXL messages must use typed schemas.
- Validate inbound and outbound payloads.
- Include a request id on every cross-agent flow.
- Keep message shapes minimal and explicit.
- Version message contracts if they change in a breaking way.
- Do not pass untyped raw blobs between agents.
- Keep transport metadata separate from domain payloads.

## Testing strategy

- Add unit tests for deterministic logic first.
- Test intent parsing with realistic plain-English inputs.
- Test planner candidate generation with clear fixtures.
- Test risk veto logic with explicit scenarios.
- Test diff rendering for stable output shape.
- Test transaction building and simulation inputs.
- Add integration tests for the Watcher -> Planner -> Risk flow.
- Avoid weak assertions that only check truthiness.

## Performance rules

- Keep `zuno` startup fast.
- Avoid blocking the interactive shell unnecessarily.
- Minimize repeated network calls.
- Cache only safe non-sensitive read data.
- Keep agent payloads compact.
- Stream or stage slower tasks when helpful.
- Do not trade correctness for minor speed gains in financial logic.

## Release and change management

- Document breaking changes clearly.
- Make behavior changes in signer, execution, or planner flows explicit.
- Avoid silent changes to security-sensitive paths.
- Keep migrations small and understandable.
- Update examples and setup docs when developer workflow changes.

## Do not merge if

- typecheck fails
- lint fails
- tests fail
- security-sensitive changes were not reviewed carefully
- docs are stale after an architectural change
- signer or execution logic became less explicit
- a new dependency was added without a clear reason

## Module cohesion and file-splitting rules

- Do not split files too early.
- Prefer fewer, stronger modules over many tiny files.
- A new file must earn its existence through a real boundary of responsibility.
- Do not create one-function-per-file structures.
- Do not create wrapper files that add no real abstraction value.
- Avoid architecture theater: more files does not mean better architecture.
- For early-stage features, default to the smallest clean structure that keeps the full flow easy to read.
- Keep the main execution flow visible in one place whenever possible.
- Optimize first for readability, cohesion, and ease of change.
- Split a module only when:
  - responsibilities clearly diverge
  - logic is reused by multiple consumers
  - file size becomes genuinely hard to navigate
  - testing becomes awkward because unrelated concerns are mixed
- Before adding a new file, ask:
  - does this improve clarity in a meaningful way
  - is this a real boundary or just a helper extraction
  - would the feature be easier to understand if this stayed inline
- Prefer 1-3 files for small features unless there is a strong reason to do more.
- Keep full pipelines easy to trace end to end.
- Refactor into more files only after the feature proves stable and clearly grows.

## Simplicity-first implementation rule

When implementing a feature, optimize in this order:

1. readability
2. cohesion
3. low file count
4. clear data flow
5. extensibility

Do not optimize for abstract architecture too early.
