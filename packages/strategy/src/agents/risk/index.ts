import { AxlClient } from "../../axl/index.js";
import { makeLogger } from "../shared/log.js";
import { handleFlowReview } from "./handler.js";

const log = makeLogger("risk");
const client = new AxlClient({ role: "risk" });

log(`online  peer=${client.peerId.slice(0, 12)}…  axl=${client.apiUrl}`);

await client.listen(async (env) => {
  if (env.kind === "flow_review") {
    await handleFlowReview(client, log, env);
  }
});
