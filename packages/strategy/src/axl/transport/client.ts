import type { AgentRole, AxlEnvelope } from "@zuno/core";
import { apiUrlFor, peerIdFor, type AxlRole } from "./discovery.js";

export interface AxlClientOptions {
  role: AxlRole;
  apiUrl?: string;
  pollIntervalMs?: number;
}

export type AxlHandler = (env: AxlEnvelope) => Promise<unknown> | unknown;

/**
 * Talks to the local Gensyn AXL node. Each peer (cli, watcher, planner,
 * risk) runs its own node — the apiUrl points at *this* role's local node,
 * not a shared relay. Routing happens by ed25519 public key in the
 * X-Destination-Peer-Id header; AXL has no concept of roles, so we look up
 * the destination peer id from env.
 */
export class AxlClient {
  readonly peerId: string;
  readonly role: AxlRole;
  readonly apiUrl: string;
  private pollInterval: number;
  private polling = false;

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

  async request<TReq, TRes>(
    env: AxlEnvelope<TReq>,
    timeoutMs = 30_000,
  ): Promise<AxlEnvelope<TRes>> {
    await this.send(env);
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const inbox = await this.recv();
      const match = inbox.find((e) => e.requestId === env.requestId && e.from === env.to);
      if (match) return match as AxlEnvelope<TRes>;
      await sleep(this.pollInterval);
    }
    throw new Error(`AXL request ${env.requestId} (${env.kind}) timed out`);
  }

  /**
   * Real AXL /recv returns at most one queued message per call (body =
   * the bytes, X-From-Peer-Id header = the sender). 204 means nothing
   * queued. We wrap into an array for backwards-compatible handler code.
   */
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

  /**
   * Real AXL /topology returns this node's view: its own public key plus
   * the peers it currently knows about. There is no role information at
   * this layer — callers reconcile peer ids against env-configured ones.
   */
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
    if (this.polling) return;
    this.polling = true;
    while (this.polling) {
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

  stop(): void {
    this.polling = false;
  }
}

export interface AxlTopology {
  ourPublicKey: string;
  peers: string[];
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
