# zuno

A terminal-native copilot for Uniswap LPs.

Zuno uses a small network of AXL-connected agents to inspect positions,
debate rebalances, and produce execution-ready liquidity plans.

```
$ zuno
◇ analyze wallet 0xabc...
◇ inspect position pos_4f2a3b
◇ recommend what I should do with this position

  ◇ watcher  read       pos_4f2a3b
  ◇ planner  propose
  ◇ risk     critique   2 candidates
  ────────────────────────────────────────────────────────

  position    WETH / USDC 0.05%
  range       2,190.79 to 2,421.19   out of range
  current     2,438.19

  ────────────────────────────────────────────────────────

  recommended 2,273.36 to 2,614.97   shift
  rejected    2,361.41 to 2,519.99   tighten
  reason      less than 36h of buffer at recent volatility

  confidence  0.82  approve_with_caution

  plan id  plan_dd4f9e0b6806
```

## Why three agents

LP management is still mostly manual. Dashboards report numbers; they don't
explain decisions. A single monolithic assistant ends up making opaque calls
on your behalf, _trust me, this is the right range._

Zuno splits the job across three specialised agents and routes them over
[Gensyn AXL](https://blog.gensyn.ai/introducing-axl/), the peer-to-peer
Agent eXchange Layer:

| agent       | does                                                       |
| ----------- | ---------------------------------------------------------- |
| **Watcher** | reads the LP position and pool tick state from chain       |
| **Planner** | proposes one or two structured rebalance candidates        |
| **Risk**    | critiques the candidates, vetoes weak ones, picks a winner |

Each agent is its own process with its own AXL peer id (ed25519). They talk
to each other directly over the AXL mesh, there is no central orchestrator.
The CLI is just another peer.

## Architecture

```
                    ┌─────────┐  flow_run    ┌──────────┐
   you ───── cli ──▶│ watcher │─────────────▶│ planner  │
                    └─────────┘              └──────────┘
                         ▲                        │
                progress │                        │ flow_review
                progress │              ┌─────────▼──────────┐
                progress │◀─── flow_run:done ──── │   risk   │
                         │              └────────────────────┘
                         │
                  axl mesh (ed25519 peer ids, /send · /recv)
```

Calculations stay deterministic in TypeScript. Tick math, range checks,
candidate generation and risk scoring are all pure functions, the model
only routes, synthesises and explains.

## Layout

```
apps/
  cli                  the `zuno` command
  web                  minimal landing page
  docs                 Mintlify documentation site
packages/
  core                 shared types: Position, Plan, AxlEnvelope, …
  intents              intent parsing + routing
  ui-terminal          terminal renderer, panels, theme
  wallet               address formatting and wallet-facing helpers
  storage              session store, plan store, persistence adapters
  uniswap              viem reads, tick math, position snapshots
  planner              deterministic recommendations + diff building
  agents               watcher, planner, risk, monitor (separate processes)
  axl                  AxlClient + peer discovery configuration
  execution            simulation preview + safe apply preparation
  config               chains, env parsing, shared config
```

## Running locally

```bash
pnpm install

# Boot the app surfaces and agent processes.
# Run a real AXL node separately and configure peer ids in .env.
pnpm dev
```

| service | port |
| ------- | ---- |
| web     | 3030 |
| docs    | 3040 |

Then, in another terminal:

```bash
pnpm cli
```

Inside the shell, try `analyze wallet 0x...`, `show positions for 0x...`, and
`recommend what I should do with this position`.

### One process at a time

```bash
pnpm watcher
pnpm planner
pnpm risk
pnpm monitor          # optional background wallet monitor
pnpm web             # next dev on :3030
pnpm docs:dev        # mintlify on :3040
pnpm cli
```

Set `ZUNO_AXL_URL` and the four `ZUNO_AXL_*_PEER_ID` values to connect the CLI
and agents to real AXL nodes.

## CLI

```
zuno

analyze wallet 0x...
show positions for 0x...
inspect position <tokenId>
which positions are out of range
recommend what I should do with this position
show me the diff
simulate it
apply it
watch my wallet
show alerts
```

The default path is read-only. Paste a wallet address or set
`ZUNO_WATCH_ADDRESS`; Zuno uses that address for position reads,
recommendations, diffs, simulation, and monitoring. No wallet connection is
required until `apply`.

Plans are persisted to `~/.zuno/plans/<planId>.json` so follow-ups like
`show me the diff` and `simulate it` work across sessions.

The optional monitor is a separate worker, not the interactive shell:

```bash
pnpm monitor
```

It polls the configured watch address, writes position alerts to
`~/.zuno/alerts.json`, and the shell can inspect them with `show alerts`.

## Environment

Zuno reads positions through viem. Configure a default read-only watch target
with:

```bash
ZUNO_WATCH_ADDRESS=0x...
ZUNO_CHAIN_ID=42161
ZUNO_ARBITRUM_RPC_URL=https://...
ZUNO_MONITOR_INTERVAL_MS=60000
ZUNO_AXL_URL=http://localhost:9002
ZUNO_AXL_CLI_PEER_ID=...
ZUNO_AXL_WATCHER_PEER_ID=...
ZUNO_AXL_PLANNER_PEER_ID=...
ZUNO_AXL_RISK_PEER_ID=...
```

Supported chains are Ethereum mainnet, Optimism, Base, and Arbitrum. RPC URLs
are optional but recommended. `ZUNO_WALLET_ADDRESS` is still accepted as a
legacy alias for the watch target.

The CLI uses deterministic intent rules first. For low-confidence phrasing,
you can enable a hosted model fallback:

```bash
# OpenAI
ZUNO_INTENT_PROVIDER=openai
OPENAI_API_KEY=...
ZUNO_INTENT_MODEL=gpt-5-nano

# or Groq, cheaper and fast enough for intent classification
ZUNO_INTENT_PROVIDER=groq
GROQ_API_KEY=...
ZUNO_INTENT_MODEL=llama-3.1-8b-instant
```

Set `ZUNO_DEBUG_INTENTS=true` to print provider failures while testing.

Execution is separate from reads. Applying a plan prepares a deterministic
transaction summary and then requires QR-based wallet approval. Configure Reown
/ WalletConnect with:

```bash
REOWN_PROJECT_ID=...
# Optional during local integration if a session URI was created externally:
ZUNO_WALLETCONNECT_URI=wc:...
```

The terminal never stores private keys or seed phrases and never silently signs.

## Status

v0.1 now has wallet-aware Uniswap v3 NFT position reads, deterministic
recommendations, plan storage, diff, simulation preview, and a guarded apply
preparation path. AXL recommendations run over separate Watcher, Planner, and
Risk peers when the mesh is online; otherwise the CLI uses the same deterministic
planner locally. Reads are address-based by default. `apply` prepares the
transaction path and requires QR wallet approval; transaction submission is
blocked until the wallet approval session is present.
