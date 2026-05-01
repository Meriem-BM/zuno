import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function loadEnvFile(cwd = process.cwd()): void {
  const root = findEnvRoot(cwd);
  if (!root) return;

  const original = new Set(Object.keys(process.env));
  for (const file of [".env", ".env.local"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/u)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      const [key, value] = parsed;
      if (!original.has(key)) process.env[key] = value;
    }
  }
}

function findEnvRoot(start: string): string | null {
  let dir = start;
  while (true) {
    if (existsSync(join(dir, ".env")) || existsSync(join(dir, ".env.local"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(trimmed);
  if (!match) return null;

  return [match[1]!, unquote(match[2]!.trim())];
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  const comment = value.indexOf(" #");
  return comment >= 0 ? value.slice(0, comment).trim() : value;
}
