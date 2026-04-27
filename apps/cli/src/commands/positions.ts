import type { Address } from "@zuno/core";
import { listPositions } from "@zuno/uniswap";
import { renderPositionsList } from "../render.js";

export async function positionsCmd(owner?: string): Promise<void> {
  const addr = (owner ?? "0xabc1230000000000000000000000000000000def") as Address;
  const positions = await listPositions(addr);
  renderPositionsList(positions);
}
