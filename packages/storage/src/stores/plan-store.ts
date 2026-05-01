import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Plan } from "@zuno/core";
import { defaultPlanDir, isNotFound, planPath } from "./helpers.js";
import type { PlanStore } from "./types.js";

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

let singleton: PlanStore | null = null;

export function defaultPlanStore(): PlanStore {
  singleton ??= createFilePlanStore();
  return singleton;
}
