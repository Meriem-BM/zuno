/**
 * Local AXL-compatible relay for development. HTTP routes mirror the real
 * Gensyn AXL daemon so clients can swap baseUrl without code changes.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AxlEnvelope } from "@zuno/core";
import {
  deliver,
  drainInbox,
  peerCount,
  registerPeer,
  snapshot,
} from "./peers.js";

const PORT = Number(process.env.ZUNO_AXL_PORT ?? 9100);

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/register") {
      const body = await readJson<{ peerId: string; role: string }>(req);
      if (!body.peerId) return send(res, 400, { error: "peerId required" });
      registerPeer(body.peerId, body.role);
      log(`+ peer registered  role=${body.role}  id=${shortId(body.peerId)}`);
      return send(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/send") {
      const body = await readJson<{ to: string; envelope: AxlEnvelope }>(req);
      if (!deliver(body.to, body.envelope)) {
        return send(res, 404, { error: `unknown peer ${body.to}` });
      }
      log(
        `→ ${body.envelope.from.padEnd(7)} → ${shortId(body.to)}  ${body.envelope.kind}`,
      );
      return send(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/recv") {
      const peerId = url.searchParams.get("peerId");
      if (!peerId) return send(res, 400, { error: "peerId required" });
      return send(res, 200, drainInbox(peerId));
    }

    if (req.method === "GET" && url.pathname === "/topology") {
      return send(res, 200, {
        peers: snapshot().map((p) => ({
          peerId: p.peerId,
          role: p.role,
          registeredAt: p.registeredAt,
          inboxDepth: p.inbox.length,
        })),
      });
    }

    if (req.method === "GET" && url.pathname === "/healthz") {
      return send(res, 200, { ok: true, peers: peerCount() });
    }

    return send(res, 404, { error: "not found" });
  } catch (err) {
    return send(res, 500, { error: (err as Error).message });
  }
});

server.listen(PORT, () => {
  log(`axl mock listening  port=${PORT}`);
  log("ready for peers, start watcher, planner, risk in separate terminals");
});

function shortId(id: string): string {
  return `${id.slice(0, 5)}…${id.slice(-4)}`;
}

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  process.stdout.write(`\x1b[90m${ts}\x1b[0m  \x1b[35maxl\x1b[0m  ${msg}\n`);
}
