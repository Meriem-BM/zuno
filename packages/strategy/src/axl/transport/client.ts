import type { AgentRole, AxlEnvelope } from "@zuno/core";
import { apiUrlFor, peerIdFor, type AxlRole } from "./discovery.js";

export interface AxlClientOptions {
  role: AxlRole;
  apiUrl?: string;
  pollIntervalMs?: number;
}

export type AxlHandler = (env: AxlEnvelope) => Promise<unknown> | unknown;

// Each peer runs its own local AXL node; apiUrl points at *this* role's
// node, not a shared relay. Routing happens by ed25519 public key in the
// X-Destination-Peer-Id header; AXL has no concept of roles, so the
// destination peer id is resolved from env at send time.
export class AxlClient {
  readonly peerId: string;
  readonly role: AxlRole;
  readonly apiUrl: string;
  private pollInterval: number;

  constructor(opts: AxlClientOptions) {
    this.role = opts.role;
    this.apiUrl = opts.apiUrl ?? apiUrlFor(opts.role);
    this.peerId = peerIdFor(opts.role);
    this.pollInterval = opts.pollIntervalMs ?? 120;
  }

  async send<T>(env: AxlEnvelope<T>): Promise<void> {
    const destination = peerIdFor(env.to);
    const res = await fetch(`${this.apiUrl}/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-destination-peer-id": destination,
      },
      body: JSON.stringify(env),
    });
    if (!res.ok) {
      throw new Error(`AXL send failed: ${res.status} ${await res.text()}`);
    }
  }

  // Real AXL /recv returns at most one queued message per call (body =
  // the bytes, X-From-Peer-Id header = the sender). 204 means nothing
  // queued. Wrapped into an array so handler code can iterate uniformly.
  async recv(): Promise<AxlEnvelope[]> {
    const res = await fetch(`${this.apiUrl}/recv`);
    if (res.status === 204) return [];
    if (!res.ok) throw new Error(`AXL recv failed: ${res.status}`);
    const text = await res.text();
    if (!text) return [];
    try {
      return [JSON.parse(text) as AxlEnvelope];
    } catch {
      return [];
    }
  }

  async topology(): Promise<AxlTopology> {
    const res = await fetch(`${this.apiUrl}/topology`);
    if (!res.ok) throw new Error(`AXL topology failed: ${res.status}`);
    const data = (await res.json()) as { our_public_key?: string; peers?: unknown };
    return {
      ourPublicKey: typeof data.our_public_key === "string" ? data.our_public_key : "",
      peers: Array.isArray(data.peers) ? (data.peers as string[]) : [],
    };
  }

  async listen(handler: AxlHandler): Promise<void> {
    while (true) {
      try {
        const inbox = await this.recv();
        for (const env of inbox) {
          if (env.from === this.role) continue;
          if (env.kind.endsWith(":response")) continue;
          try {
            const result = await handler(env);
            if (result !== undefined) {
              await this.send({
                requestId: env.requestId,
                from: this.role as AgentRole,
                to: env.from,
                kind: `${env.kind}:response`,
                payload: result,
                ts: Date.now(),
              });
            }
          } catch (err) {
            await this.send({
              requestId: env.requestId,
              from: this.role as AgentRole,
              to: env.from,
              kind: `${env.kind}:error`,
              payload: { message: (err as Error).message },
              ts: Date.now(),
            });
          }
        }
      } catch {}
      await sleep(this.pollInterval);
    }
  }
}

export interface AxlTopology {
  ourPublicKey: string;
  peers: string[];
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
