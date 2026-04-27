import type { AxlEnvelope } from "@zuno/core";

export interface PeerEntry {
  peerId: string;
  role: string;
  inbox: AxlEnvelope[];
  registeredAt: number;
}

const peers = new Map<string, PeerEntry>();

export function registerPeer(peerId: string, role: string): void {
  const existing = peers.get(peerId);
  peers.set(peerId, {
    peerId,
    role: role || "unknown",
    inbox: existing?.inbox ?? [],
    registeredAt: Date.now(),
  });
}

export function deliver(peerId: string, env: AxlEnvelope): boolean {
  const target = peers.get(peerId);
  if (!target) return false;
  target.inbox.push(env);
  return true;
}

export function drainInbox(peerId: string): AxlEnvelope[] {
  const peer = peers.get(peerId);
  return peer ? peer.inbox.splice(0) : [];
}

export function snapshot(): PeerEntry[] {
  return [...peers.values()];
}

export function peerCount(): number {
  return peers.size;
}
