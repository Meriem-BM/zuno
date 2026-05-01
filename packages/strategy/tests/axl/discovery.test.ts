import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { apiUrlFor, peerIdFor, shortPeer } from "../../src/axl/index.js";

const peerKey = "ZUNO_AXL_WATCHER_PEER_ID";
const apiKey = "ZUNO_AXL_PLANNER_API_URL";
const previousPeer = process.env[peerKey];
const previousApi = process.env[apiKey];

afterEach(() => {
  if (previousPeer === undefined) delete process.env[peerKey];
  else process.env[peerKey] = previousPeer;
  if (previousApi === undefined) delete process.env[apiKey];
  else process.env[apiKey] = previousApi;
});

describe("AXL peer discovery", () => {
  it("reads configured peer ids", () => {
    process.env[peerKey] = "zrealwatcherpeer";
    assert.equal(peerIdFor("watcher"), "zrealwatcherpeer");
  });

  it("fails clearly when a peer id is missing", () => {
    delete process.env[peerKey];
    assert.throws(() => peerIdFor("watcher"), /ZUNO_AXL_WATCHER_PEER_ID/u);
  });

  it("returns a per-role default api url when env is unset", () => {
    delete process.env[apiKey];
    assert.equal(apiUrlFor("planner"), "http://127.0.0.1:9022");
  });

  it("honours per-role api url overrides", () => {
    process.env[apiKey] = "http://127.0.0.1:9999";
    assert.equal(apiUrlFor("planner"), "http://127.0.0.1:9999");
  });

  it("shortens peer ids for terminal output", () => {
    assert.equal(shortPeer("z123456789abcdef"), "z1234…cdef");
  });
});
