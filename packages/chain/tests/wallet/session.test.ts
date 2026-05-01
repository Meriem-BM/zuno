import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  clearSession,
  isExpired,
  loadSession,
  saveSession,
  type Session,
} from "../../src/wallet/index.js";

const tmpFile = join(tmpdir(), `zuno-session-${process.pid}-${Date.now()}.json`);

const baseSession: Session = {
  email: "ada@example.com",
  subOrganizationId: "subOrgA",
  agentWalletAddress: "0xabc1230000000000000000000000000000000def",
  walletId: "wid-1",
  apiPrivateKey: "deadbeef",
  apiPublicKey: "feedface",
  expiresAt: Date.now() + 60_000,
};

beforeEach(() => {
  process.env.ZUNO_SESSION_PATH = tmpFile;
});

afterEach(async () => {
  delete process.env.ZUNO_SESSION_PATH;
  try {
    await fs.unlink(tmpFile);
  } catch {}
});

describe("session store", () => {
  it("returns null when no file exists", async () => {
    assert.equal(await loadSession(), null);
  });

  it("round-trips a valid session and writes mode 0600", async () => {
    await saveSession(baseSession);
    const stat = await fs.stat(tmpFile);
    assert.equal(stat.mode & 0o777, 0o600);
    const loaded = await loadSession();
    assert.deepEqual(loaded, baseSession);
  });

  it("treats expired sessions as missing", async () => {
    await saveSession({ ...baseSession, expiresAt: Date.now() - 1000 });
    assert.equal(await loadSession(), null);
  });

  it("clearSession removes the file", async () => {
    await saveSession(baseSession);
    await clearSession();
    assert.equal(await loadSession(), null);
  });

  it("isExpired reflects current time", () => {
    assert.equal(isExpired(baseSession), false);
    assert.equal(isExpired({ ...baseSession, expiresAt: Date.now() - 1 }), true);
  });
});
