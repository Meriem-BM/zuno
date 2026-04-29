import type { AgentRole, AxlEnvelope } from "@zuno/core";
import { peerIdFor } from "./discovery.js";

export interface AxlClientOptions {
  baseUrl?: string;
  role: AgentRole | "cli";
  pollIntervalMs?: number;
}

export type AxlHandler = (env: AxlEnvelope) => Promise<unknown> | unknown;

export class AxlClient {
  readonly peerId: string;
  readonly role: AgentRole | "cli";
  readonly baseUrl: string;
  private pollInterval: number;
  private polling = false;

  constructor(opts: AxlClientOptions) {
    this.role = opts.role;
    this.baseUrl = opts.baseUrl ?? process.env.ZUNO_AXL_URL ?? "http://localhost:9002";
    this.peerId = peerIdFor(opts.role);
    this.pollInterval = opts.pollIntervalMs ?? 120;
  }

  async register(): Promise<void> {
    const deadline = Date.now() + 10_000;
    let lastErr: unknown;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${this.baseUrl}/register`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ peerId: this.peerId, role: this.role }),
        });
        if (res.ok) return;
        throw new Error(`AXL register failed: ${res.status} ${await res.text()}`);
      } catch (err) {
        lastErr = err;
        await sleep(250);
      }
    }
    throw new Error(
      `AXL register timed out at ${this.baseUrl}: ${(lastErr as Error)?.message ?? lastErr}`,
    );
  }

  async send<T>(env: AxlEnvelope<T>): Promise<void> {
    const to = peerIdFor(env.to);
    const res = await fetch(`${this.baseUrl}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to, envelope: env }),
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

  async recv(): Promise<AxlEnvelope[]> {
    const res = await fetch(`${this.baseUrl}/recv?peerId=${encodeURIComponent(this.peerId)}`);
    if (!res.ok) throw new Error(`AXL recv failed: ${res.status}`);
    return (await res.json()) as AxlEnvelope[];
  }

  async topology(): Promise<{ peers: { peerId: string; role: string }[] }> {
    const res = await fetch(`${this.baseUrl}/topology`);
    return (await res.json()) as { peers: { peerId: string; role: string }[] };
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

  subscribeFeed(handler: (event: AxlFeedEvent) => void): () => void {
    const ctrl = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/feed`, { signal: ctrl.signal });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
            if (!dataLine) continue;
            try {
              const parsed = JSON.parse(dataLine.slice(6)) as AxlFeedEvent;
              if (parsed.type === "envelope") handler(parsed);
            } catch {}
          }
        }
      } catch {}
    })();
    return () => ctrl.abort();
  }
}

export interface AxlFeedEvent {
  type: "envelope";
  envelope: AxlEnvelope;
  toPeerId: string;
  toRole: string;
  observedAt: number;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
