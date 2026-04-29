import type { ToolRegistry } from "../contracts/types.js";
import { AGENT_TOOLS } from "./agent-tools.js";
import { PLAN_TOOLS } from "./plan-tools.js";
import { POSITION_TOOLS } from "./position-tools.js";
import { RECOMMENDATION_TOOLS } from "./recommendation-tools.js";
import { WALLET_TOOLS } from "./wallet-tools.js";
import { MONITOR_TOOLS } from "./monitor-tools.js";

export const TOOLS: ToolRegistry = [
  ...WALLET_TOOLS,
  ...POSITION_TOOLS,
  ...RECOMMENDATION_TOOLS,
  ...PLAN_TOOLS,
  ...AGENT_TOOLS,
  ...MONITOR_TOOLS,
];

export { AGENT_TOOLS } from "./agent-tools.js";
export { PLAN_TOOLS } from "./plan-tools.js";
export { POSITION_TOOLS } from "./position-tools.js";
export { RECOMMENDATION_TOOLS } from "./recommendation-tools.js";
export { WALLET_TOOLS } from "./wallet-tools.js";
export { MONITOR_TOOLS } from "./monitor-tools.js";
