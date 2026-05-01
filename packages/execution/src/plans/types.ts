import type { Address, ChainId, Hex, RiskNote } from "@zuno/core";

export interface SimulationStep {
  label: string;
  detail: string;
}

export interface PlanSimulation {
  planId: string;
  positionId: string;
  pair: string;
  feeTier: number;
  oldRange: { priceLower: number; priceUpper: number };
  targetRange: { priceLower: number; priceUpper: number };
  steps: SimulationStep[];
  estimatedGas: string;
  estimatedGasUnits?: string;
  estimatedGasUsd: number;
  estimatedSlippage: number;
  onchainStatus: "not_checked" | "passed" | "failed";
  revertReason?: string;
  warnings: string[];
  canApply: boolean;
}

export interface ExecutionTransaction {
  from: Address;
  to: Address;
  chainId: ChainId;
  data: Hex;
  value?: string;
}

export interface PolicyCheck {
  allowed: boolean;
  reasons: string[];
}

export interface ApprovalReadiness {
  tokenSymbol: string;
  requiredWei: string;
  currentAllowanceWei?: string;
  sufficient: boolean;
  reason?: string;
}

export interface ApplyPreview {
  planId: string;
  positionId: string;
  agentWalletAddress: Address;
  status: "ready_for_turnkey" | "blocked";
  summary: string;
  pair: string;
  feeTier: number;
  oldRange: { priceLower: number; priceUpper: number };
  newRange: { priceLower: number; priceUpper: number };
  residual: { token0: string; token1: string };
  estimatedGas: string;
  estimatedGasUnits?: string;
  estimatedGasUsd: number;
  estimatedSlippage: number;
  onchainStatus: PlanSimulation["onchainStatus"];
  approvalReadiness: ApprovalReadiness[];
  verdict: RiskNote["verdict"];
  confidence: number;
  reasons: string[];
  steps: SimulationStep[];
  warnings: string[];
  policy: PolicyCheck;
  transaction?: ExecutionTransaction;
}

export interface SimulationOptions {
  account?: Address;
  checkChain?: boolean;
}

export interface ApplyPreviewOptions extends SimulationOptions {
  checkAllowances?: boolean;
}
