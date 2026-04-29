import type { ChainId, Plan, RiskNote, SignerMode } from "@zuno/core";

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
  estimatedGasUsd: number;
  estimatedSlippage: number;
  warnings: string[];
  canApply: boolean;
}

export interface ApplyPreview {
  planId: string;
  positionId: string;
  signerMode: SignerMode;
  status: "requires_wallet_signature" | "blocked";
  summary: string;
  pair: string;
  feeTier: number;
  oldRange: { priceLower: number; priceUpper: number };
  newRange: { priceLower: number; priceUpper: number };
  residual: { token0: string; token1: string };
  estimatedGas: string;
  estimatedGasUsd: number;
  estimatedSlippage: number;
  verdict: RiskNote["verdict"];
  confidence: number;
  reasons: string[];
  steps: SimulationStep[];
  warnings: string[];
  approval: WalletApprovalPreview;
}

export interface WalletApprovalPreview {
  kind: "walletconnect_qr";
  status: "requires_project_id" | "requires_session" | "ready";
  uri: string | null;
  instructions: string[];
}

export function simulatePlan(plan: Plan): PlanSimulation {
  const warnings: string[] = [];
  if (plan.risk.verdict === "approve_with_caution") {
    warnings.push("risk review approved with caution; inspect slippage and gas before signing");
  }
  if (!plan.snapshot.range.inRange) {
    warnings.push("current position is out of range, so execution may require swapping inventory");
  }

  const gas = estimateGas(plan.snapshot.position.pool.chainId);
  const pair = `${plan.snapshot.position.pool.token0.symbol}/${plan.snapshot.position.pool.token1.symbol}`;

  return {
    planId: plan.id,
    positionId: plan.positionId,
    pair,
    feeTier: plan.snapshot.position.pool.feeTier,
    oldRange: {
      priceLower: plan.snapshot.range.priceLower,
      priceUpper: plan.snapshot.range.priceUpper,
    },
    targetRange: {
      priceLower: plan.recommended.priceLower,
      priceUpper: plan.recommended.priceUpper,
    },
    steps: executionSteps(plan),
    estimatedGas: gas.label,
    estimatedGasUsd: gas.usd,
    estimatedSlippage: 0.002,
    warnings,
    canApply: plan.risk.verdict !== "reject",
  };
}

export function prepareApply(plan: Plan, signerMode: SignerMode): ApplyPreview {
  const simulation = simulatePlan(plan);
  const residual = {
    token0: plan.recommended.residual0,
    token1: plan.recommended.residual1,
  };

  if (signerMode !== "wallet") {
    return {
      planId: plan.id,
      positionId: plan.positionId,
      signerMode,
      status: "blocked",
      summary: "Enclave execution is not enabled for this wallet session.",
      pair: simulation.pair,
      feeTier: simulation.feeTier,
      oldRange: simulation.oldRange,
      newRange: simulation.targetRange,
      residual,
      estimatedGas: simulation.estimatedGas,
      estimatedGasUsd: simulation.estimatedGasUsd,
      estimatedSlippage: simulation.estimatedSlippage,
      verdict: plan.risk.verdict,
      confidence: plan.risk.confidence,
      reasons: plan.risk.reasons,
      steps: simulation.steps,
      warnings: ["use wallet mode until enclave authority is explicitly configured"],
      approval: walletApprovalPreview(false),
    };
  }

  return {
    planId: plan.id,
    positionId: plan.positionId,
    signerMode,
    status: "requires_wallet_signature",
    summary: "Transaction prepared. Zuno will submit only after QR wallet approval.",
    pair: simulation.pair,
    feeTier: simulation.feeTier,
    oldRange: simulation.oldRange,
    newRange: simulation.targetRange,
    residual,
    estimatedGas: simulation.estimatedGas,
    estimatedGasUsd: simulation.estimatedGasUsd,
    estimatedSlippage: simulation.estimatedSlippage,
    verdict: plan.risk.verdict,
    confidence: plan.risk.confidence,
    reasons: plan.risk.reasons,
    steps: simulation.steps,
    warnings: simulation.warnings,
    approval: walletApprovalPreview(true),
  };
}

function walletApprovalPreview(enabled: boolean): WalletApprovalPreview {
  if (!enabled) {
    return {
      kind: "walletconnect_qr",
      status: "requires_project_id",
      uri: null,
      instructions: ["wallet approval is available only in wallet mode"],
    };
  }

  const uri = process.env.ZUNO_WALLETCONNECT_URI ?? null;
  if (uri) {
    return {
      kind: "walletconnect_qr",
      status: "ready",
      uri,
      instructions: [
        "scan the terminal QR with your phone wallet",
        "approve in the wallet only after reviewing the transaction summary",
      ],
    };
  }

  const projectId = process.env.REOWN_PROJECT_ID ?? process.env.WALLETCONNECT_PROJECT_ID;
  if (!projectId) {
    return {
      kind: "walletconnect_qr",
      status: "requires_project_id",
      uri: null,
      instructions: [
        "set REOWN_PROJECT_ID to create a terminal QR approval session",
        "Zuno will not ask for private keys or seed phrases",
      ],
    };
  }

  return {
    kind: "walletconnect_qr",
    status: "requires_session",
    uri: null,
    instructions: [
      "Reown project id is configured; create a WalletConnect session for this prepared transaction",
      "scan the terminal QR with your phone wallet",
      "approve in the wallet only after reviewing the transaction summary",
    ],
  };
}

function executionSteps(plan: Plan): SimulationStep[] {
  const pair = `${plan.snapshot.position.pool.token0.symbol}/${plan.snapshot.position.pool.token1.symbol}`;
  return [
    {
      label: "collect",
      detail: `collect unclaimed ${pair} fees from position ${plan.positionId}`,
    },
    {
      label: "remove",
      detail: "remove liquidity from the current tick range",
    },
    {
      label: "rebalance",
      detail: `prepare inventory for ${plan.recommended.priceLower.toFixed(2)} to ${plan.recommended.priceUpper.toFixed(2)}`,
    },
    {
      label: "mint",
      detail: `open ${plan.recommended.kind} range using reviewed candidate`,
    },
  ];
}

function estimateGas(chainId: ChainId): { label: string; usd: number } {
  const v3MintBurnGas = 350_000;
  const ethProxyUsd = 2000;
  const gwei = chainId === 1 ? 30 : chainId === 8453 ? 0.04 : chainId === 10 ? 0.001 : 0.07; // arbitrum default
  const eth = (gwei * v3MintBurnGas) / 1e9;
  const usd = eth * ethProxyUsd;
  const label =
    chainId === 1
      ? `~${eth.toFixed(4)} ETH (≈$${usd.toFixed(2)})`
      : `~${eth.toFixed(6)} ETH (≈$${usd.toFixed(2)})`;
  return { label, usd };
}
