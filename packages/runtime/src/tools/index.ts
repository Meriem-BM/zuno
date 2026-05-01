import type { ToolRegistry } from "../contracts/types.js";
import { AGENT_TOOLS } from "./agent/index.js";
import { APPROVAL_TOOLS } from "./approval/index.js";
import { BALANCE_TOOLS } from "./balance/index.js";
import { MONITOR_TOOLS } from "./monitor/index.js";
import { NETWORK_TOOLS } from "./network/index.js";
import { PLAN_TOOLS } from "./plan/index.js";
import { POSITION_TOOLS } from "./position/index.js";
import { RECOMMENDATION_TOOLS } from "./recommendation/index.js";
import { SWAP_TOOLS } from "./swap/index.js";
import { WALLET_TOOLS } from "./wallet/index.js";

export const TOOLS: ToolRegistry = [
  ...WALLET_TOOLS,
  ...BALANCE_TOOLS,
  ...NETWORK_TOOLS,
  ...APPROVAL_TOOLS,
  ...SWAP_TOOLS,
  ...POSITION_TOOLS,
  ...RECOMMENDATION_TOOLS,
  ...PLAN_TOOLS,
  ...AGENT_TOOLS,
  ...MONITOR_TOOLS,
];
