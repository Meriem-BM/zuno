# zuno

A terminal-native copilot for Uniswap LPs.

Zuno pairs a Turnkey-backed agent wallet with a four-agent debate over [Gensyn AXL](https://blog.gensyn.ai/introducing-axl/). Scout, Strategist, Critic, Arbiter, that observes a position, proposes ranges, stress-tests them, and converges on an execution-ready liquidity plan with a full transcript. Your main wallet stays separate, the Zuno wallet is the execution wallet.

```
$ zuno
◇ create my zuno wallet
◇ inspect my positions
◇ recommend what I should do with this position

  ◇ scout       regime: ranging · vol 110bps · gas 14gwei · in range
  ◇ strategist  3 candidates · lean tighter, vol is sleeping
  ◇ critic      reject A: 18h buffer is fine now, vol mean-reverts
  ◇ strategist  A': ±2.6% · 28h buffer · $3.60/d expected
  ◇ critic      accept A' - converged

  position    WETH / USDC 0.05%
  range       2,190.79 → 2,421.19   out of range
  current     2,438.19

  recommended 2,273.36 → 2,614.97   shift
  rejected    2,361.41 → 2,519.99   tighten at 2× vol
  reason      28h base buffer · survives 2× vol · gas/yield 0.71x
  decided by  critic · debate converged

  confidence  0.82  approve_with_caution
  signer      zuno wallet through Turnkey
```

## Why four agents

LP management is a real tension between fee density and survival. A monolithic copilot picks one side and tells you to trust it. A debate models the tension explicitly, and the AXL transcript makes the reasoning auditable.

| agent          | does                                                               |
| -------------- | ------------------------------------------------------------------ |
| **Scout**      | reads LP position + pool tick state, classifies the market regime  |
| **Strategist** | proposes 2-5 candidate ranges; revises after critique              |
| **Critic**     | stress-tests every candidate (1×, 2×, 3× vol); vetoes weak ones    |
| **Arbiter**    | only joins on deadlock; picks final candidate from the full debate |

The LLM owns reasoning. Numbers come from deterministic helpers: tick math, range checks, allocation, stress simulation, real `eth_gasPrice`, real CoinGecko volatility, fee-yield estimation. The Strategist picks proportions; it can't fabricate raw tick numbers. The Critic's floors come from the user's risk profile (`conservative | balanced | aggressive`).

Each agent runs as its own process with its own ed25519 peer id. They talk over the AXL mesh; there is no central orchestrator. The CLI is just another peer.

## What Zuno does

- **Create new LP positions** from prose. `create a position with 0.05 ETH passively` extracts a goal, surveys live pools on the chain via real on-chain probing of the v4 PoolManager, runs the four-agent debate, and prepares a mint action. Apply signs through Turnkey.
- **Rebalance existing positions** end-to-end. `recommend what I should do with this position` runs the same debate against an existing position; `diff`, `simulate`, `approve`, `apply` follow.
- **Real on-chain pool discovery.** `discoverPools(chainId)` enumerates `(token, token, feeTier)` combinations from the curated token registry, computes the deterministic v4 pool id, and probes `StateView.getSlot0` + `getLiquidity`. Cached at `~/.zuno/pools-{chainId}.json` with a 30-minute TTL. `refresh pools` forces a re-probe.
- **Live debate transcript** rendered in the CLI and persisted into `risk.reasons` so `explain recommendation` can replay it.
- **Three execution paths**: real AXL mesh first, in-process orchestrator (same handlers, single Node process) if mesh peers aren't visible, deterministic fallback if no LLM is available.
- **Goal-extraction clarification.** Bare prompts trigger one follow-up turn (`which token and how much?`) before the debate runs.
- **Email-OTP sign-in** with per-user Turnkey sub-org and isolated wallet; sessions persisted to `~/.zuno/session.json` (0600).
- **Balances, allowances, network switch**, ERC20 `approve` prepared-action flow, Uniswap Trading API-backed standalone swaps with onchain v4 quote fallback.
- **Deterministic v4 position manager calldata** for mint, increaseLiquidity, decreaseLiquidity, collect, burn, plus the rebalance multicall.

## Layout

```
apps/        deployable surfaces - see apps/README.md
packages/    workspace libraries  - see packages/README.md
tooling/     AXL bootstrap + deploy scripts
```

- **[`apps/README.md`](./apps/README.md)** - what each app ships (`@zunocli/cli`, `@zuno/web`, `@zuno/docs`, `@zuno/proxy`).
- **[`packages/README.md`](./packages/README.md)** - what each package owns (`@zuno/core`, `@zuno/chain`, `@zuno/strategy`, `@zuno/runtime`, `@zuno/execution`, `@zuno/storage`, `@zuno/terminal`) and the dependency graph.

The four agents live under `packages/strategy/src/agents/`:

```
scout/        chain read + regime classifier
strategist/   range proposer + reviser
critic/       stress-test adversary
arbiter/      deadlock-breaker
shared/       LLM runner, transcript channel, deterministic tools
orchestrator.ts   in-process debate runner (used as fallback)
```

## Action surface

Tools are organized by action category. Read actions hit chain or local state; prepare/review actions return structured previews; execute actions return `needs_confirmation` results that the shell holds until the user types `approve it`.

| category    | tools                                                                                                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **read**    | `showAgentWallet`, `showBalances`, `showNetwork`, `showAllowances`, `inspectPosition`, `listPositions`, `listOutOfRangePositions`, `listRiskyPositions`, `showQuote`, `showAlerts`, `showPeers`, `showAgentStatus`, `refreshPools` |
| **prepare** | `prepareSwap`, `recommendRebalance`, `showRebalanceOptions`, `createPosition`                                                                                                                                                      |
| **review**  | `showPlanDiff`, `simulatePlan`, `explainRecommendation`                                                                                                                                                                            |
| **execute** | `approveToken`, `swapTokens`, `approvePlan`, `applyPlan`, `switchNetwork`, `monitorWallet`                                                                                                                                         |

## Run locally

```bash
pnpm install
cp .env.example .env

# Bootstrap 5 Gensyn AXL nodes (cli + 4 agents) and print the peer ids
bash tooling/axl-bootstrap.sh    # paste the env block into .env

# Run each AXL node in its own terminal
./node -config tooling/axl/cli-config.json
./node -config tooling/axl/scout-config.json
./node -config tooling/axl/strategist-config.json
./node -config tooling/axl/critic-config.json
./node -config tooling/axl/arbiter-config.json

# All four agents in one process (dev convenience)
pnpm --filter @zuno/strategy start:agents

#   ...or one terminal per agent:
#   pnpm --filter @zuno/strategy start:scout
#   pnpm --filter @zuno/strategy start:strategist
#   pnpm --filter @zuno/strategy start:critic
#   pnpm --filter @zuno/strategy start:arbiter

pnpm dev                         # web :3030, docs :3040
pnpm cli                         # interactive shell
```

Inside the shell:

```
create my zuno wallet
show my balances
what network am I on   ·   switch to arbitrum or sepolia
show my allowances
swap 1 ETH to USDC          # prepares a Trading API-backed swap, then waits for approval
approve USDC                # prepares an approve, awaits "approve it"
inspect my positions
create a position with 0.05 ETH passively   # brand-new LP via four-agent debate
recommend what I should do with this position
show me the diff   ·   simulate it
explain recommendation       # replay the debate transcript
approve it   ·   apply it
refresh pools                 # re-discover live v4 pools on the chain
show alerts
```

Plans persist to `~/.zuno/plans/<planId>.json` so follow-ups (`show me the diff`, `simulate it`, `explain recommendation`) survive across sessions. Apply blocks until the user approves and the policy check accepts the deterministic transaction; signing then routes through Turnkey.

## Without the mesh

If the four agent peers aren't visible on AXL, the CLI falls back to an in-process orchestrator that runs the same four handlers in one Node process. Same prompts, same deterministic tools, same transcript; only the transport changes.

If `OPENAI_API_KEY` is also unset (or `ZUNO_DETERMINISTIC=true`), the rebalance flow falls back further to deterministic `recommendPlan` math (fixed multipliers, threshold-rule critique). The demo still works offline; the debate just doesn't.

## Sign-in

The first wallet-bearing intent (`create my zuno wallet`, `inspect my positions`, …) opens a side flow that asks for your email and a one-time code Turnkey emails you. On success the CLI bootstraps a Turnkey **sub-organization** for your email (with its own Ethereum wallet) and saves a 3-hour session at `~/.zuno/session.json` (mode 0600). Subsequent intents pick that session up automatically; once it expires the side flow reopens.

The parent-org credentials in `.env` are used only to send the OTP and create the sub-org. Turnkey's architecture gives the parent **read-only** access to sub-org wallets; every signature comes from your own session keys, not the parent org.

## Environment

For the published CLI, users provide their own service keys as shell env vars:

```bash
export OPENAI_API_KEY=sk-...
export ZUNO_ARBITRUM_RPC_URL=https://...
export ZUNO_UNISWAP_TRADING_API_KEY=...
zuno
```

The CLI prints a non-blocking startup notice for missing optional env. Wallet sign-in uses the hosted auth proxy baked into the published bundle; self-hosters can set `ZUNO_AUTH_PROXY_URL` or local Turnkey parent credentials.

See [`.env.example`](./.env.example). Supported chains are mainnet, optimism, base, arbitrum, sepolia, base sepolia, arbitrum sepolia, and unichain sepolia. RPC URLs are optional but strongly recommended to avoid public RPC limits. The intent fallback supports `openai` and `groq`; deterministic rules run first either way. Standalone swaps use the Uniswap Trading API and require `ZUNO_UNISWAP_TRADING_API_KEY`. The agent debate requires `OPENAI_API_KEY`; tune the model with `ZUNO_AGENT_MODEL`, the round cap with `ZUNO_MAX_DEBATE_ROUNDS`, and the user's risk profile with `ZUNO_RISK_PROFILE`.
