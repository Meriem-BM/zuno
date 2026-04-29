import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Plan, PositionAlert } from "@zuno/core";

export interface PlanStore {
  save(plan: Plan): Promise<void>;
  get(planId: string): Promise<Plan | null>;
  latest(): Promise<Plan | null>;
}

export interface AlertStore {
  save(alert: PositionAlert): Promise<void>;
  list(limit?: number): Promise<PositionAlert[]>;
  latestForPosition(positionId: string): Promise<PositionAlert | null>;
  acknowledge(alertId: string): Promise<PositionAlert | null>;
}

export function createMemoryPlanStore(initial: Plan[] = []): PlanStore {
  const plans = new Map(initial.map((plan) => [plan.id, plan]));
  let latestId = initial.at(-1)?.id ?? null;
  return {
    async save(plan) {
      plans.set(plan.id, plan);
      latestId = plan.id;
    },
    async get(planId) {
      return plans.get(planId) ?? null;
    },
    async latest() {
      return latestId ? (plans.get(latestId) ?? null) : null;
    },
  };
}

export function createFilePlanStore(root = defaultPlanDir()): PlanStore {
  let latestId: string | null = null;
  return {
    async save(plan) {
      const file = planPath(root, plan.id);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
      latestId = plan.id;
      await writeFile(join(root, "latest"), plan.id, "utf8");
    },
    async get(planId) {
      try {
        return JSON.parse(await readFile(planPath(root, planId), "utf8")) as Plan;
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    async latest() {
      if (!latestId) {
        try {
          latestId = (await readFile(join(root, "latest"), "utf8")).trim();
        } catch (error) {
          if (isNotFound(error)) return null;
          throw error;
        }
      }
      return latestId ? this.get(latestId) : null;
    },
  };
}

export function createMemoryAlertStore(initial: PositionAlert[] = []): AlertStore {
  const alerts = new Map(initial.map((alert) => [alert.id, alert]));
  return {
    async save(alert) {
      alerts.set(alert.id, alert);
    },
    async list(limit = 20) {
      return [...alerts.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    },
    async latestForPosition(positionId) {
      return (await this.list()).find((alert) => alert.positionId === positionId) ?? null;
    },
    async acknowledge(alertId) {
      const alert = alerts.get(alertId);
      if (!alert) return null;
      const next = { ...alert, acknowledgedAt: Date.now() };
      alerts.set(alertId, next);
      return next;
    },
  };
}

export function createFileAlertStore(root = defaultAlertDir()): AlertStore {
  return {
    async save(alert) {
      const alerts = await readAlerts(root);
      const existing = alerts.findIndex((item) => item.id === alert.id);
      if (existing >= 0) alerts[existing] = alert;
      else alerts.push(alert);
      await writeAlerts(root, alerts);
    },
    async list(limit = 20) {
      const alerts = await readAlerts(root);
      return alerts.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    },
    async latestForPosition(positionId) {
      return (await this.list()).find((alert) => alert.positionId === positionId) ?? null;
    },
    async acknowledge(alertId) {
      const alerts = await readAlerts(root);
      const existing = alerts.find((alert) => alert.id === alertId);
      if (!existing) return null;
      existing.acknowledgedAt = Date.now();
      await writeAlerts(root, alerts);
      return existing;
    },
  };
}

let singleton: PlanStore | null = null;
let alertSingleton: AlertStore | null = null;

export function defaultPlanStore(): PlanStore {
  singleton ??= createFilePlanStore();
  return singleton;
}

export function defaultAlertStore(): AlertStore {
  alertSingleton ??= createFileAlertStore();
  return alertSingleton;
}

function defaultPlanDir(): string {
  return process.env.ZUNO_PLAN_DIR ?? join(homedir(), ".zuno", "plans");
}

function defaultAlertDir(): string {
  return process.env.ZUNO_ALERT_DIR ?? join(homedir(), ".zuno");
}

function planPath(root: string, planId: string): string {
  return join(root, `${planId}.json`);
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function readAlerts(root: string): Promise<PositionAlert[]> {
  try {
    return JSON.parse(await readFile(alertPath(root), "utf8")) as PositionAlert[];
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}

async function writeAlerts(root: string, alerts: PositionAlert[]): Promise<void> {
  const file = alertPath(root);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(alerts, null, 2)}\n`, "utf8");
}

function alertPath(root: string): string {
  return join(root, "alerts.json");
}
