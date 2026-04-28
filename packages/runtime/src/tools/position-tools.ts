import type { InspectPositionData, ToolDefinition } from "../types.js";
import { err, ok, resolvePositionId } from "./shared.js";

export function mockPosition(positionId: string): InspectPositionData {
  return {
    positionId,
    pair: "ETH/USDC",
    feeTier: 500,
    rangeStatus: "OUT_OF_RANGE",
    priceLower: 2190.79,
    priceUpper: 2421.19,
    priceCurrent: 2438.19,
  };
}

const inspectPosition: ToolDefinition = {
  name: "inspectPosition",
  intents: ["inspect_position"],
  execute: (intent, ctx) => {
    const positionId = resolvePositionId(intent, ctx);
    if (!positionId) {
      return err("inspectPosition", "POSITION_NOT_FOUND", "No position id provided.");
    }
    return ok("inspectPosition", `Loaded position ${positionId}.`, mockPosition(positionId));
  },
};

const inspectAllPositions: ToolDefinition = {
  name: "inspectAllPositions",
  intents: ["inspect_all_positions"],
  execute: () =>
    ok("inspectAllPositions", "Loaded all positions.", {
      positions: [mockPosition("42"), mockPosition("77")],
    }),
};

const checkRangeStatus: ToolDefinition = {
  name: "checkRangeStatus",
  intents: ["check_range_status"],
  execute: (intent, ctx) => {
    const positionId = resolvePositionId(intent, ctx);
    if (!positionId) {
      return err("checkRangeStatus", "POSITION_NOT_FOUND", "No position id provided.");
    }
    const pos = mockPosition(positionId);
    return ok("checkRangeStatus", `Position ${positionId} is ${pos.rangeStatus}.`, {
      positionId,
      rangeStatus: pos.rangeStatus,
      priceLower: pos.priceLower,
      priceUpper: pos.priceUpper,
      priceCurrent: pos.priceCurrent,
    });
  },
};

const listOutOfRangePositions: ToolDefinition = {
  name: "listOutOfRangePositions",
  intents: ["list_out_of_range_positions"],
  execute: () =>
    ok("listOutOfRangePositions", "1 position out of range.", {
      positions: [mockPosition("42")],
    }),
};

const listRiskyPositions: ToolDefinition = {
  name: "listRiskyPositions",
  intents: ["list_risky_positions"],
  execute: () =>
    ok("listRiskyPositions", "1 position flagged as risky.", {
      positions: [
        {
          positionId: "42",
          pair: "ETH/USDC",
          reason: "out of range with low buffer at recent volatility",
        },
      ],
    }),
};

export const POSITION_TOOLS: readonly ToolDefinition[] = [
  inspectPosition,
  inspectAllPositions,
  checkRangeStatus,
  listOutOfRangePositions,
  listRiskyPositions,
];
