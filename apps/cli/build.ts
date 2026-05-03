/**
 * Bundle apps/cli for `npm publish`.
 *
 *   pnpm --filter @zunocli/cli build
 *
 * Produces a self-contained ESM bundle at apps/cli/dist/index.js with a
 * Node shebang, executable permissions, and a slim package.json beside it
 * (`name: "@zunocli/cli"`, `bin: { zuno: "./index.js" }`). Workspace deps are
 * inlined; the bundle has no `@zuno/*` resolvers at install time.
 *
 * To release:
 *   pnpm --filter @zunocli/cli build
 *   cd apps/cli/dist
 *   npm publish --access public
 */
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname);
const dist = join(root, "dist");
const sourcePkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
  version: string;
  description?: string;
};

const PUBLISHED_NAME = "@zunocli/cli";
const DEVTOOLS_STUB = "zuno:react-devtools-core-stub";

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const proxyUrl = process.env.ZUNO_PUBLIC_PROXY_URL ?? "";

const result = await esbuild.build({
  entryPoints: [join(root, "src/index.tsx")],
  outfile: join(dist, "index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  // Keep Turnkey native deps external. Everything else is bundled.
  external: ["@turnkey/sdk-server", "@turnkey/crypto"],
  plugins: [
    {
      name: "stub-react-devtools",
      setup(build) {
        build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
          path: DEVTOOLS_STUB,
          namespace: "zuno-stubs",
        }));
        build.onLoad(
          { filter: /^zuno:react-devtools-core-stub$/, namespace: "zuno-stubs" },
          () => ({
            contents: "export default { connectToDevTools() {} };",
            loader: "js",
          }),
        );
      },
    },
  ],
  banner: {
    js: [
      "#!/usr/bin/env node",
      'import { createRequire as __zunoCreateRequire } from "node:module";',
      "const require = __zunoCreateRequire(import.meta.url);",
    ].join("\n"),
  },
  minify: false,
  sourcemap: false,
  legalComments: "none",
  loader: { ".tsx": "tsx", ".ts": "ts" },
  jsx: "automatic",
  metafile: true,
  // Bake the public proxy URL at release time. Local dev / self-host
  // paths still respect a runtime ZUNO_AUTH_PROXY_URL override since
  // the wallet auth code reads process.env directly.
  define: proxyUrl
    ? {
        "process.env.ZUNO_AUTH_PROXY_URL": JSON.stringify(proxyUrl),
      }
    : {},
});

await chmod(join(dist, "index.js"), 0o755);

const publishedPkg = {
  name: PUBLISHED_NAME,
  version: sourcePkg.version,
  description: sourcePkg.description ?? "Terminal-native copilot for Uniswap LPs",
  type: "module",
  bin: { zuno: "./index.js" },
  main: "./index.js",
  files: ["index.js"],
  engines: { node: ">=20" },
  // Only the truly-external deps we left out of the bundle.
  dependencies: {
    "@turnkey/sdk-server": "^5.3.0",
    "@turnkey/crypto": "^2.8.14",
  },
  keywords: ["uniswap", "defi", "cli", "liquidity", "lp"],
  license: "MIT",
};
await writeFile(join(dist, "package.json"), JSON.stringify(publishedPkg, null, 2) + "\n", "utf8");

const sizeKb = Math.round(Object.values(result.metafile!.outputs)[0]!.bytes / 1024);
process.stdout.write(`✓ bundled apps/cli → dist/index.js (${sizeKb} KB)\n`);
