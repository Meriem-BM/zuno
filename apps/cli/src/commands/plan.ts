import { AxlClient } from "@zuno/axl";
import type { AxlEnvelope, InspectRequest, Plan } from "@zuno/core";
import { newRequestId } from "@zuno/core";
import { banner, planToDiff, progressLine, renderPlan } from "../render.js";
import { faint, fg, header, line, muted, pink } from "../style.js";
import { savePlan } from "../storage.js";

export async function planCmd(positionId: string): Promise<void> {
  banner();
  line(header("zuno plan", positionId));
  line();

  const cli = new AxlClient({ role: "cli" });
  try {
    await cli.register();
  } catch (err) {
    line(`  ${pink("!")} ${fg("axl unreachable")} ${muted("- is the axl daemon running?")}`);
    line(`    ${muted("start it with")} ${pink("bun run axl:mock")} ${muted("(then watcher / planner / risk)")}`);
    process.exit(1);
  }

  const requestId = newRequestId();

  const kickoff: AxlEnvelope<InspectRequest> = {
    requestId,
    from: "cli",
    to: "watcher",
    kind: "flow_run",
    payload: { positionId },
    ts: Date.now(),
  };

  await cli.send(kickoff);

  const seen = new Set<string>();
  const start = Date.now();
  const TIMEOUT = 30_000;

  while (Date.now() - start < TIMEOUT) {
    const inbox = await cli.recv();
    for (const env of inbox) {
      if (env.requestId !== requestId) continue;

      if (env.kind === "progress") {
        const { stage, detail } = env.payload as { stage: string; detail?: string };
        const key = `${env.from}:${stage}`;
        if (seen.has(key)) continue;
        seen.add(key);
        progressLine(stage, detail);
      }

      if (env.kind === "flow_run:done") {
        const plan = env.payload as Plan;
        const path = savePlan(plan);
        renderPlan(plan);
        line(`  ${faint("saved")} ${muted(path)}`);
        line();
        return;
      }

      if (env.kind.endsWith(":error")) {
        const { message } = env.payload as { message: string };
        line(`  ${pink("!")} ${fg(`agent error from ${env.from}`)}  ${muted(message)}`);
        process.exit(1);
      }
    }
    await new Promise((r) => setTimeout(r, 80));
  }

  line(`  ${pink("!")} ${fg("flow timed out")} ${muted("- check that watcher, planner and risk are running")}`);
  process.exit(1);
}
