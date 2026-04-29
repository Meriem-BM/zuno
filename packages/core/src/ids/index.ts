import { randomBytes } from "node:crypto";

export const newPlanId = (): string => `plan_${randomBytes(6).toString("hex")}`;
export const newRequestId = (): string => `req_${randomBytes(8).toString("hex")}`;
export const newAlertId = (): string => `alert_${randomBytes(6).toString("hex")}`;
