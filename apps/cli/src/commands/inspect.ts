import { buildSnapshot, getPosition } from "@zuno/uniswap";
import { renderInspect } from "../render.js";

export async function inspectCmd(positionId: string): Promise<void> {
  const position = await getPosition(positionId);
  const snapshot = buildSnapshot(position);
  renderInspect(snapshot);
}
