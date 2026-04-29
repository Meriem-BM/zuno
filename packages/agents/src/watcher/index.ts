import { AxlClient } from "@zuno/axl";
import { makeLogger } from "../shared/log.js";
import { handleFlowRun } from "./handler.js";

const log = makeLogger("watcher");
const client = new AxlClient({ role: "watcher" });

await client.register();
log(`online  peer=${client.peerId.slice(0, 12)}…`);

await client.listen(async (env) => {
  if (env.kind === "flow_run") {
    await handleFlowRun(client, log, env);
  }
});
