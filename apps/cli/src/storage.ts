import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Plan } from "@zuno/core";

const PLAN_DIR = join(homedir(), ".zuno", "plans");

function ensureDir(): void {
  mkdirSync(PLAN_DIR, { recursive: true });
}

export function savePlan(plan: Plan): string {
  ensureDir();
  const path = join(PLAN_DIR, `${plan.id}.json`);
  writeFileSync(path, JSON.stringify(plan, null, 2), "utf8");
  return path;
}

export function loadPlan(planId: string): Plan {
  const path = join(PLAN_DIR, `${planId}.json`);
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as Plan;
}

export function listPlanIds(): string[] {
  ensureDir();
  return readdirSync(PLAN_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}
