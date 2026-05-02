import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { CreateStart } from "@zuno/core";
import { runDebateCreate } from "../../src/agents/orchestrator.js";

/**
 * Deterministic-fallback orchestrator test for the create flow.
 *
 * No LLM, no live RPC. We stub the pool cache so `discoverPools` returns
 * a curated set of fake-but-shape-correct pool entries on the test chain
 * id (11155111). This exercises the full chain:
 *   scout-create → strategist-create → critic-create → (orchestrator)
 * and asserts a Plan{ kind: "create" } comes out.
 *
 * Skipped when OPENAI_API_KEY is set so we always hit deterministic
 * paths in CI; pass ZUNO_DETERMINISTIC=true to force.
 */

describe("runDebateCreate (deterministic, fixture-backed)", () => {
  let cacheDir: string;
  let prevCacheDir: string | undefined;
  let prevDeterministic: string | undefined;
  let prevKey: string | undefined;

  beforeEach(() => {
    prevCacheDir = process.env.ZUNO_POOL_CACHE_DIR;
    prevDeterministic = process.env.ZUNO_DETERMINISTIC;
    prevKey = process.env.OPENAI_API_KEY;
    cacheDir = mkdtempSync(join(tmpdir(), "zuno-orch-"));
    process.env.ZUNO_POOL_CACHE_DIR = cacheDir;
    process.env.ZUNO_DETERMINISTIC = "true";
    delete process.env.OPENAI_API_KEY;
    seedFixture(cacheDir);
  });

  afterEach(() => {
    if (prevCacheDir === undefined) delete process.env.ZUNO_POOL_CACHE_DIR;
    else process.env.ZUNO_POOL_CACHE_DIR = prevCacheDir;
    if (prevDeterministic === undefined) delete process.env.ZUNO_DETERMINISTIC;
    else process.env.ZUNO_DETERMINISTIC = prevDeterministic;
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
  });

  it("produces a Plan with kind=\"create\" using deterministic fallbacks", async () => {
    const start: CreateStart = {
      goal: {
        capital: { tokenSymbol: "weth", amount: "0.05" },
        riskProfile: "balanced",
        exposurePreference: "neutral",
      },
    };
    const result = await runDebateCreate({ start, chainId: 11155111 });
    assert.equal(result.plan.kind, "create");
    assert.match(result.plan.id, /^plan_/u);
    assert.ok(BigInt(result.plan.recommended.deploy0) >= 0n);
    assert.ok(BigInt(result.plan.recommended.deploy1) >= 0n);
    assert.match(result.plan.positionId, /^create:/u);
    assert.ok(result.ready.transcript.length > 0, "transcript should have thoughts");
    // Verify the agents emitted something from each role.
    const roles = new Set(result.ready.transcript.map((t) => t.role));
    assert.ok(roles.has("scout"), "scout emitted");
    assert.ok(roles.has("strategist"), "strategist emitted");
    assert.ok(roles.has("critic"), "critic emitted");
  });
});

function seedFixture(dir: string): void {
  const weth = {
    address: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
    symbol: "WETH",
    decimals: 18,
  };
  const usdc = {
    address: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
    symbol: "USDC",
    decimals: 6,
  };
  const entry = (feeTier: number, liquidity: string) => ({
    poolManager: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
    poolId: `0x${feeTier.toString(16).padStart(64, "0")}`,
    pool: {
      address: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
      chainId: 11155111,
      token0: weth,
      token1: usdc,
      feeTier,
      tickSpacing: feeTier === 500 ? 10 : feeTier === 3000 ? 60 : 200,
      currentTick: 0,
      sqrtPriceX96: "79228162514264337593543950336",
      liquidity,
      price: 1,
    },
  });
  writeFileSync(
    join(dir, `pools-11155111.json`),
    JSON.stringify({
      fetchedAt: Date.now(),
      chainId: 11155111,
      entries: [entry(500, "12345678901234567890"), entry(3000, "9876543210987654321")],
    }),
  );
}
