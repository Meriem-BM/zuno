#!/usr/bin/env bun
/**
 * zuno, terminal-native Uniswap LP copilot
 */

import { diffCmd } from "./commands/diff.js";
import { inspectCmd } from "./commands/inspect.js";
import { planCmd } from "./commands/plan.js";
import { positionsCmd } from "./commands/positions.js";
import { faint, fg, line, muted, pink } from "./style.js";

const argv = process.argv.slice(2);

async function main(): Promise<void> {
  const [a, b, c] = argv;

  if (!a || a === "--help" || a === "-h" || a === "help") {
    return printHelp();
  }

  if (a === "wallet" && b === "positions") {
    return positionsCmd(c);
  }
  if (a === "inspect" && b) {
    return inspectCmd(b);
  }
  if (a === "plan" && b) {
    return planCmd(b);
  }
  if (a === "diff" && b) {
    return diffCmd(b);
  }

  printHelp();
  process.exit(2);
}

function printHelp(): void {
  line();
  line(`  ${pink("◇")}  ${fg("zuno")} ${muted("v0.1 · multi-agent over axl")}`);
  line();
  line(`  ${muted("usage")}`);
  line(`    ${fg("zuno wallet positions")} ${muted("[owner]")}`);
  line(`    ${fg("zuno inspect")} ${pink("<positionId>")}`);
  line(`    ${fg("zuno plan")}    ${pink("<positionId>")}`);
  line(`    ${fg("zuno diff")}    ${pink("<planId>")}`);
  line();
  line(`  ${muted("env")}`);
  line(`    ${faint("ZUNO_AXL_URL")}  ${muted("axl node base url (default http://localhost:9100)")}`);
  line();
}

main().catch((err) => {
  line(`  ${pink("!")} ${fg(err.message)}`);
  process.exit(1);
});
