import type { Plan, PositionAlert, PreparedActionRecord } from "@zuno/core";

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

export interface PreparedActionStore {
  save(record: PreparedActionRecord): Promise<void>;
  get(id: string): Promise<PreparedActionRecord | null>;
  latest(): Promise<PreparedActionRecord | null>;
}
