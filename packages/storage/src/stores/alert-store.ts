import type { PositionAlert } from "@zuno/core";
import { defaultAlertDir, readAlerts, writeAlerts } from "./helpers.js";
import type { AlertStore } from "./types.js";

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

let singleton: AlertStore | null = null;

export function defaultAlertStore(): AlertStore {
  singleton ??= createFileAlertStore();
  return singleton;
}
