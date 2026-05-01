import { serve } from "@hono/node-server";
import app from "./index.js";

const port = Number(process.env.PORT ?? 8787);
serve(
  {
    fetch: (req) =>
      app.fetch(req, {
        TURNKEY_API_BASE_URL: process.env.TURNKEY_API_BASE_URL ?? "https://api.turnkey.com",
        TURNKEY_ORGANIZATION_ID: process.env.TURNKEY_ORGANIZATION_ID ?? "",
        TURNKEY_API_PUBLIC_KEY: process.env.TURNKEY_API_PUBLIC_KEY ?? "",
        TURNKEY_API_PRIVATE_KEY: process.env.TURNKEY_API_PRIVATE_KEY ?? "",
      }),
    port,
  },
  (info) => {
    process.stdout.write(`zuno-auth proxy listening on http://localhost:${info.port}\n`);
  },
);
