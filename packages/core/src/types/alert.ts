import type { Address, ChainId } from "./primitives.js";

export type AlertSeverity = "info" | "warning" | "critical";

export interface PositionAlert {
  id: string;
  walletAddress: Address;
  chainId: ChainId;
  positionId: string;
  severity: AlertSeverity;
  kind: "out_of_range" | "near_boundary";
  message: string;
  reason: string;
  createdAt: number;
  acknowledgedAt?: number;
}

export interface MonitorReport {
  walletAddress: Address;
  chainId: ChainId;
  checkedAt: number;
  positionCount: number;
  alertCount: number;
  alerts: PositionAlert[];
}
