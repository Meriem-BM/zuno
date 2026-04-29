import { AxlClient } from "@zuno/axl";
import { makeLogger } from "../shared/log.js";
import { handleFlowPropose } from "./handler.js";

const log = makeLogger("planner");
const client = new AxlClient({ role: "planner" });

await client.register();
log(`online  peer=${client.peerId.slice(0, 12)}…`);

await client.listen(async (env) => {
  if (env.kind === "flow_propose") {
    await handleFlowPropose(client, log, env);
  }
});
