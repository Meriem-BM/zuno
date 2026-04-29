# @zuno/axl

Zuno's transport layer over Gensyn AXL.

Watcher, Planner, Risk, and the CLI are separate peers. The CLI sends a
`flow_run` envelope to Watcher, Watcher sends state to Planner, Planner sends
candidates to Risk, and Risk returns the reviewed plan to the CLI.

## Configuration

```bash
ZUNO_AXL_URL=http://localhost:9002
ZUNO_AXL_CLI_PEER_ID=...
ZUNO_AXL_WATCHER_PEER_ID=...
ZUNO_AXL_PLANNER_PEER_ID=...
ZUNO_AXL_RISK_PEER_ID=...
```

Peer ids must come from the AXL nodes you run. Zuno does not derive local peer
ids or ship an in-process relay.

## Envelope

```ts
interface AxlEnvelope<T> {
  requestId: string;
  from: AgentRole;
  to: AgentRole;
  kind: string;
  payload: T;
  ts: number;
}
```

## Flow

| kind              | direction            | payload                               |
| ----------------- | -------------------- | ------------------------------------- |
| `flow_run`        | `cli -> watcher`     | `InspectRequest`                      |
| `progress`        | `* -> cli`           | `{ stage: string, detail?: string }`  |
| `flow_propose`    | `watcher -> planner` | `{ requestId, snapshot }`             |
| `flow_review`     | `planner -> risk`    | `{ requestId, snapshot, candidates }` |
| `flow_run:done`   | `risk -> cli`        | `Plan`                                |
| `<kind>:response` | auto                 | listener return value                 |
| `<kind>:error`    | auto                 | `{ message: string }`                 |

`src/client.ts` is the only module that talks to AXL. Agent handlers only see
typed envelopes.
