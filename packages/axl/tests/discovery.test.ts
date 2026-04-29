import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { peerIdFor, shortPeer } from "../src/index.js";

const key = "ZUNO_AXL_WATCHER_PEER_ID";
const previous = process.env[key];

afterEach(() => {
  if (previous === undefined) delete process.env[key];
  else process.env[key] = previous;
});

describe("AXL peer discovery", () => {
  it("reads configured peer ids", () => {
    process.env[key] = "zrealwatcherpeer";
    assert.equal(peerIdFor("watcher"), "zrealwatcherpeer");
  });

  it("fails clearly when a peer id is missing", () => {
    delete process.env[key];
    assert.throws(() => peerIdFor("watcher"), /ZUNO_AXL_WATCHER_PEER_ID/u);
  });

  it("shortens peer ids for terminal output", () => {
    assert.equal(shortPeer("z123456789abcdef"), "z1234…cdef");
  });
});
