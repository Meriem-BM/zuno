import { planToDiff, renderDiff } from "../render.js";
import { loadPlan } from "../storage.js";

export async function diffCmd(planId: string): Promise<void> {
  const plan = loadPlan(planId);
  const diff = planToDiff(plan);
  renderDiff(diff, plan);
}
