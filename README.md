# zuno

A terminal-native copilot for Uniswap LPs.

Zuno pairs a Turnkey-backed agent wallet with three [Gensyn AXL](https://blog.gensyn.ai/introducing-axl/) peers — Watcher, Planner, Risk — that inspect positions, debate rebalances, and produce execution-ready liquidity plans. Your main wallet stays separate; the Zuno wallet is the execution wallet.

```
$ zuno
◇ create my zuno wallet
◇ inspect my positions
◇ recommend what I should do with this position

  position    WETH / USDC 0.05%
  range       2,190.79 → 2,421.19   out of range
  current     2,438.19

  recommended 2,273.36 → 2,614.97   shift
  rejected    2,361.41 → 2,519.99   tighten
  reason      less than 36h of buffer at recent volatility

  confidence  0.82  approve_with_caution
  signer      zuno wallet through Turnkey
```

## Why three agents

Calculations stay deterministic in TypeScript — tick math, range checks, candidates, risk scoring. The model only routes, synthesises, and explains.

| agent       | does                                                   |
| ----------- | ------------------------------------------------------ |
| **Watcher** | reads LP position and pool tick state from chain       |
| **Planner** | proposes one or two structured rebalance candidates    |
| **Risk**    | critiques candidates, vetoes weak ones, picks a winner |

Each agent is its own process with its own ed25519 peer id. They talk over the AXL mesh; there is no central orchestrator. The CLI is just another peer.

## Layout

```
apps/
  cli         the `zuno` command
  web         landing page (Next 16)
  docs        Mintlify docs
packages/
  core        shared types + ids
  config      chains, env
  intents     deterministic intent parser + model fallback
  ui-terminal Ink renderer, panels, theme
  wallet      Turnkey sub-org auth + signer boundary
  storage     plan / alert / prepared-action stores
  uniswap     all Uniswap V3 bindings: positions, tick math, quoter, NFT manager
  tokens      native + ERC20 balances, allowances, approve calldata
  planner     deterministic candidates + risk-aware critique
  execution   simulation preview + policy check + safe apply
  agents      watcher, planner, risk, monitor (separate processes)
  axl         AxlClient + peer discovery
  runtime     intent → action registry + executor
```

## Action surface

Tools are organized by action category. Read actions hit chain or local state; prepare/review actions return structured previews; execute actions return `needs_confirmation` results that the shell holds until the user types `approve it`.

| category    | tools                                                                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **read**    | `showAgentWallet`, `showBalances`, `showNetwork`, `showAllowances`, `inspectPosition`, `listPositions`, `listOutOfRangePositions`, `listRiskyPositions`, `showQuote`, `showAlerts`, `showPeers`, `showAgentStatus` |
| **prepare** | `prepareSwap`, `recommendRebalance`, `showRebalanceOptions`                                                                                                                                                        |
| **review**  | `showPlanDiff`, `simulatePlan`, `explainRecommendation`                                                                                                                                                            |
| **execute** | `approveToken`, `approvePlan`, `applyPlan`, `switchNetwork`, `monitorWallet`                                                                                                                                       |

## Run locally

```bash
pnpm install
cp .env.example .env

# Bootstrap 4 Gensyn AXL nodes (one per role) and print the peer ids
bash tooling/axl-bootstrap.sh    # paste the env block into .env

# Run each AXL node in its own terminal
./node -config tooling/axl/cli-config.json
./node -config tooling/axl/watcher-config.json
./node -config tooling/axl/planner-config.json
./node -config tooling/axl/risk-config.json

# Then the Zuno processes
pnpm dev                         # web :3030, docs :3040
pnpm watcher                     # one terminal each
pnpm planner
pnpm risk
pnpm cli                         # interactive shell
```

Inside the shell:

```
create my zuno wallet
show my balances
what network am I on   ·   switch to arbitrum
show my allowances
swap 1 ETH to USDC          # quote-only — execute is on the roadmap
approve USDC                # prepares an approve, awaits "approve it"
inspect my positions
recommend what I should do with this position
show me the diff   ·   simulate it
approve it   ·   apply it
show alerts
```

Plans persist to `~/.zuno/plans/<planId>.json` so follow-ups (`show me the diff`, `simulate it`) survive across sessions. Apply blocks until the user approves and the policy check accepts the deterministic transaction; signing then routes through Turnkey.

## Sign-in

The first wallet-bearing intent (`create my zuno wallet`, `inspect my positions`, …) opens a side flow that asks for your email and a one-time code Turnkey emails you. On success the CLI bootstraps a Turnkey **sub-organization** for your email (with its own Ethereum wallet) and saves a 1-hour session at `~/.zuno/session.json` (mode 0600). Subsequent intents pick that session up automatically; once it expires the side flow reopens.

The parent-org credentials in `.env` are used only to send the OTP and create the sub-org. Turnkey's architecture gives the parent **read-only** access to sub-org wallets — every signature comes from your own session keys, not the parent org.

## Environment

See [`.env.example`](./.env.example). Supported chains are mainnet, optimism, base, arbitrum. RPC URLs are optional. The intent fallback supports `openai` and `groq` — deterministic rules run first either way.

## Status

v0.1:

- email-OTP sign-in, per-user Turnkey sub-org with isolated wallet
- balances (native + per-chain ERC20 whitelist + position tokens)
- network detection + session-level switch
- allowance reads + ERC20 `approve` prepared-action flow
- Uniswap V3 QuoterV2 swap quote + best-fee-tier route
- deterministic V3 NFT manager calldata: mint, increaseLiquidity, decreaseLiquidity, collect, burn, plus the rebalance multicall
- `recommend → diff → simulate → approve → apply` end-to-end with policy gate and Turnkey signing

Roadmap:

- swap execution via SwapRouter02 (multi-hop, slippage, deadline)
- standalone LP create/add/remove tools (the calldata builders are already in `@zuno/chain/uniswap`)
- richer balance formatting (USD totals, gas budgeting)
