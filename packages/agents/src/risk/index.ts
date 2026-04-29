import { AxlClient } from "@zuno/axl";
import { makeLogger } from "../shared/log.js";
import { handleFlowReview } from "./handler.js";

const log = makeLogger("risk");
const client = new AxlClient({ role: "risk" });

await client.register();
log(`online  peer=${client.peerId.slice(0, 12)}…`);

await client.listen(async (env) => {
  if (env.kind === "flow_review") {
    await handleFlowReview(client, log, env);
  }
});
