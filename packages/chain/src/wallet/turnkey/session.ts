import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { isValidSession, sessionPath } from "./lib/helpers.js";
import type { Session } from "./types.js";

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await fs.readFile(sessionPath(), "utf8");
    const parsed = JSON.parse(raw) as Session;
    if (!isValidSession(parsed)) return null;
    if (parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  const path = sessionPath();
  await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await fs.writeFile(path, JSON.stringify(session, null, 2), { mode: 0o600 });
  await fs.chmod(path, 0o600);
}

export async function clearSession(): Promise<void> {
  try {
    await fs.unlink(sessionPath());
  } catch {}
}

export function isExpired(session: Session): boolean {
  return session.expiresAt <= Date.now();
}
