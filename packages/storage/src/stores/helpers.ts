import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { PositionAlert } from "@zuno/core";

export function defaultPlanDir(): string {
  return process.env.ZUNO_PLAN_DIR ?? join(homedir(), ".zuno", "plans");
}

export function defaultAlertDir(): string {
  return process.env.ZUNO_ALERT_DIR ?? join(homedir(), ".zuno");
}

export function defaultPreparedActionDir(): string {
  return process.env.ZUNO_ACTION_DIR ?? join(homedir(), ".zuno", "actions");
}

export function planPath(root: string, planId: string): string {
  return join(root, `${planId}.json`);
}

export function preparedActionPath(root: string, id: string): string {
  return join(root, `${id}.json`);
}

export function alertPath(root: string): string {
  return join(root, "alerts.json");
}

export function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export async function readAlerts(root: string): Promise<PositionAlert[]> {
  try {
    return JSON.parse(await readFile(alertPath(root), "utf8")) as PositionAlert[];
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}

export async function writeAlerts(root: string, alerts: PositionAlert[]): Promise<void> {
  const file = alertPath(root);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(alerts, null, 2)}\n`, "utf8");
}
