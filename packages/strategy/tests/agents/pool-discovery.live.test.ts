import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discoverPools } from "../../src/agents/shared/lib/pools.js";

/**
 * Live Sepolia pool discovery test.
 *
 * Skipped unless ZUNO_SEPOLIA_RPC_URL is set, since CI shouldn't depend
 * on a public RPC. Run locally with:
 *
 *   ZUNO_SEPOLIA_RPC_URL=https://... pnpm --filter @zuno/strategy test
 *
 * The probe enumerates every (token, token, feeTier) tuple from the
 * registry and asks Sepolia's StateView contract whether each pool is
 * initialized + liquid. We only assert the call shape - pool counts
 * vary as Uniswap deploys new test pools.
 */

const haveRpc = Boolean(process.env.ZUNO_SEPOLIA_RPC_URL);

describe("discoverPools - live Sepolia (gated)", () => {
  it("returns pool entries with valid shape", { skip: !haveRpc }, async () => {
    const pools = await discoverPools(11155111, {}, { refresh: true });
    assert.ok(Array.isArray(pools), "pools should be an array");
    for (const entry of pools) {
      assert.match(entry.poolId, /^0x[0-9a-f]{64}$/u, "poolId is bytes32");
      assert.equal(entry.pool.chainId, 11155111);
      assert.ok(BigInt(entry.pool.liquidity) > 0n, "liquidity > 0");
      assert.ok(BigInt(entry.pool.sqrtPriceX96) > 0n, "initialized");
    }
  });
});
