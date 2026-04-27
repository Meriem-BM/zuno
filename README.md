# zuno

A terminal-native copilot for Uniswap LPs.

Zuno uses a small network of AXL-connected agents to inspect positions,
debate rebalances, and produce execution-ready liquidity plans.

```
$ zuno plan pos_4f2a3b

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

  plan id  plan_dd4f9e0b6806    zuno diff plan_dd4f9e0b6806
```

## Why three agents

LP management is still mostly manual. Dashboards report numbers; they don't
explain decisions. A single monolithic assistant ends up making opaque calls
on your behalf, _trust me, this is the right range._

Zuno splits the job across three specialised agents and routes them over
[Gensyn AXL](https://blog.gensyn.ai/introducing-axl/), the peer-to-peer
Agent eXchange Layer:

| agent       | does                                                        |
|-------------|-------------------------------------------------------------|
| **Watcher** | reads the LP position and pool tick state from chain        |
| **Planner** | proposes one or two structured rebalance candidates         |
| **Risk**    | critiques the candidates, vetoes weak ones, picks a winner  |

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
  wallet               wallet session, signer flows
  storage              session store, plan store, persistence adapters
  uniswap              tick math, position read, fixtures
  planner              deterministic rebalance logic + diff building
  agents               watcher, planner, risk (separate processes)
  axl                  AxlClient + Gensyn-AXL-compatible mock daemon
  execution            simulation, tx building, apply flow
  config               chains, env parsing, shared config
tooling/               demo script + walk-through notes
```

## Running locally

```bash
pnpm install

# Boot everything in one command, web, docs, AXL relay, all 3 agents
pnpm dev
```

| service  | port  |
|----------|-------|
| web      | 3030  |
| docs     | 3040  |
| axl mock | 9100  |

Then, in another terminal:

```bash
pnpm cli plan pos_4f2a3b
```

### Just the mesh + a plan

```bash
pnpm demo
```

### One process at a time

```bash
pnpm axl:mock        # local AXL-compatible relay on :9100
pnpm watcher
pnpm planner
pnpm risk
pnpm web             # next dev on :3030
pnpm docs:dev        # mintlify on :3040
pnpm cli plan pos_4f2a3b
```

The bundled relay implements the same HTTP surface as the real Gensyn AXL
node (`POST /send`, `GET /recv`, `GET /topology`). Point `ZUNO_AXL_URL` at a
real `axl` daemon on `localhost:9002` and nothing else changes.


## CLI

```
zuno wallet positions [owner]
zuno inspect <positionId>
zuno plan    <positionId>
zuno diff    <planId>
```

Plans are persisted to `~/.zuno/plans/<planId>.json` so `zuno diff` works
across sessions.

## Status

v0.1, fixture positions, AXL-compatible mock relay, no on-chain execution.
The shape is real; the data is offline. `zuno apply` and live RPC reads land
next.
