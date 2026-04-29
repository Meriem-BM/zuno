import {
  buildSnapshot,
  getPosition,
  isRiskyPosition,
  listPositions,
  pairName,
  rangeStatus,
  riskReason,
} from "@zuno/uniswap";
import type { InspectPositionData, ToolDefinition } from "../contracts/types.js";
import { err, missingReadTarget, ok, resolvePositionId, resolveReadTarget } from "./shared.js";

const inspectPosition: ToolDefinition = {
  name: "inspectPosition",
  intents: ["inspect_position"],
  execute: async (intent, ctx) => {
    const positionId = resolvePositionId(intent, ctx);
    if (!positionId) {
      return err("inspectPosition", "POSITION_NOT_FOUND", "No position id provided.");
    }
    const target = resolveReadTarget(intent, ctx);
    if (!target) return missingReadTarget("inspectPosition");
    try {
      const position = await getPosition(positionId, {
        owner: target.address,
        chainId: target.chainId,
      });
      return ok(
        "inspectPosition",
        `Loaded position ${positionId}.`,
        inspectData(positionId, buildSnapshot(position)),
      );
    } catch (error) {
      return err("inspectPosition", "CHAIN_READ_FAILED", errorMessage(error));
    }
  },
};

const inspectAllPositions: ToolDefinition = {
  name: "inspectAllPositions",
  intents: ["inspect_all_positions"],
  execute: async (intent, ctx) => {
    const target = resolveReadTarget(intent, ctx);
    if (!target) return missingReadTarget("inspectAllPositions");
    try {
      const positions = await listPositions(target.address, { chainId: target.chainId });
      return ok("inspectAllPositions", `Loaded ${positions.length} positions.`, {
        positions: positions.map((position) => inspectData(position.id, buildSnapshot(position))),
      });
    } catch (error) {
      return err("inspectAllPositions", "CHAIN_READ_FAILED", errorMessage(error));
    }
  },
};

const checkRangeStatus: ToolDefinition = {
  name: "checkRangeStatus",
  intents: ["check_range_status"],
  execute: async (intent, ctx) => {
    const positionId = resolvePositionId(intent, ctx);
    if (!positionId) {
      return err("checkRangeStatus", "POSITION_NOT_FOUND", "No position id provided.");
    }
    const target = resolveReadTarget(intent, ctx);
    if (!target) return missingReadTarget("checkRangeStatus");
    try {
      const position = await getPosition(positionId, {
        owner: target.address,
        chainId: target.chainId,
      });
      const snapshot = buildSnapshot(position);
      return ok(
        "checkRangeStatus",
        `Position ${positionId} is ${rangeStatus(snapshot)}.`,
        inspectData(positionId, snapshot),
      );
    } catch (error) {
      return err("checkRangeStatus", "CHAIN_READ_FAILED", errorMessage(error));
    }
  },
};

const listOutOfRangePositions: ToolDefinition = {
  name: "listOutOfRangePositions",
  intents: ["list_out_of_range_positions"],
  execute: async (intent, ctx) => {
    const target = resolveReadTarget(intent, ctx);
    if (!target) return missingReadTarget("listOutOfRangePositions");
    try {
      const positions = await listPositions(target.address, { chainId: target.chainId });
      const out = positions
        .map((position) => buildSnapshot(position))
        .filter((snapshot) => !snapshot.range.inRange);
      return ok(
        "listOutOfRangePositions",
        `${out.length} position${out.length === 1 ? "" : "s"} out of range.`,
        {
          positions: out.map((snapshot) => inspectData(snapshot.position.id, snapshot)),
        },
      );
    } catch (error) {
      return err("listOutOfRangePositions", "CHAIN_READ_FAILED", errorMessage(error));
    }
  },
};

const listRiskyPositions: ToolDefinition = {
  name: "listRiskyPositions",
  intents: ["list_risky_positions"],
  execute: async (intent, ctx) => {
    const target = resolveReadTarget(intent, ctx);
    if (!target) return missingReadTarget("listRiskyPositions");
    try {
      const positions = await listPositions(target.address, { chainId: target.chainId });
      const risky = positions.map((position) => buildSnapshot(position)).filter(isRiskyPosition);
      return ok(
        "listRiskyPositions",
        `${risky.length} position${risky.length === 1 ? "" : "s"} flagged as risky.`,
        {
          positions: risky.map((snapshot) => ({
            positionId: snapshot.position.id,
            pair: pairName(snapshot.position),
            reason: riskReason(snapshot),
          })),
        },
      );
    } catch (error) {
      return err("listRiskyPositions", "CHAIN_READ_FAILED", errorMessage(error));
    }
  },
};

export const POSITION_TOOLS: readonly ToolDefinition[] = [
  inspectPosition,
  inspectAllPositions,
  checkRangeStatus,
  listOutOfRangePositions,
  listRiskyPositions,
];

function inspectData(
  positionId: string,
  snapshot: ReturnType<typeof buildSnapshot>,
): InspectPositionData {
  return {
    positionId,
    pair: pairName(snapshot.position),
    feeTier: snapshot.position.pool.feeTier,
    rangeStatus: rangeStatus(snapshot),
    priceLower: snapshot.range.priceLower,
    priceUpper: snapshot.range.priceUpper,
    priceCurrent: snapshot.range.priceCurrent,
    liquidity: snapshot.position.liquidity,
    utilization: snapshot.range.utilization,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
