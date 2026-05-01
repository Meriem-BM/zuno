import { AxlClient } from "../../axl/index.js";
import { makeLogger } from "../shared/log.js";
import { handleFlowRun } from "./handler.js";

const log = makeLogger("watcher");
const client = new AxlClient({ role: "watcher" });

log(`online  peer=${client.peerId.slice(0, 12)}…  axl=${client.apiUrl}`);

await client.listen(async (env) => {
  if (env.kind === "flow_run") {
    await handleFlowRun(client, log, env);
  }
});
