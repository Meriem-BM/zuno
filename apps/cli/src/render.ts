import type { Plan, PlanCandidate, PlanDiff, Position, PositionSnapshot } from "@zuno/core";
import { formatAmount, formatPrice } from "@zuno/uniswap";
import { c, fg, faint, header, hr, line, mark, muted, pink, pinkDeep, row } from "./style.js";

export function banner(): void {
  line();
  line(`  ${pink("◇")}  ${fg("zuno")} ${muted("v0.1 · multi-agent over axl")}`);
  line();
}

export function renderPositionsList(positions: Position[]): void {
  banner();
  line(`  ${muted("positions")}  ${fg(String(positions.length))}`);
  line();
  for (const p of positions) {
    const pair = `${p.pool.token0.symbol}/${p.pool.token1.symbol}`;
    const fee = `${(p.pool.feeTier / 10_000).toFixed(2)}%`;
    line(
      `  ${pink("·")} ${fg(p.id.padEnd(12))}  ${muted(pair.padEnd(12))}${muted(fee.padEnd(8))}${faint("→")}  ${muted(p.pool.address.slice(0, 10))}…`,
    );
  }
  line();
}

export function renderInspect(snapshot: PositionSnapshot): void {
  const { position: p, range } = snapshot;
  banner();
  line(header("zuno inspect", p.id));
  line();
  line(row("position", `${p.pool.token0.symbol} / ${p.pool.token1.symbol} ${(p.pool.feeTier / 10_000).toFixed(2)}%`));
  line(row("pool", `${p.pool.address.slice(0, 10)}…  ${muted("chain " + p.pool.chainId)}`));
  line();
  line(row("range", `${formatPrice(range.priceLower)} to ${formatPrice(range.priceUpper)}`,
    range.inRange ? muted("in range") : pinkDeep("out of range")));
  line(row("current", formatPrice(range.priceCurrent)));
  line(row("util", range.inRange ? `${(range.utilization * 100).toFixed(1)}%` : `−${range.distanceFromBoundary} ticks`));
  line();
  line(row("amount0", `${formatAmount(p.amount0, p.pool.token0.decimals)} ${muted(p.pool.token0.symbol)}`));
  line(row("amount1", `${formatAmount(p.amount1, p.pool.token1.decimals)} ${muted(p.pool.token1.symbol)}`));
  if (p.feesOwed0 !== "0" || p.feesOwed1 !== "0") {
    line(row("fees", `${formatAmount(p.feesOwed0, p.pool.token0.decimals)} ${muted(p.pool.token0.symbol)}  +  ${formatAmount(p.feesOwed1, p.pool.token1.decimals)} ${muted(p.pool.token1.symbol)}`));
  }
  line();
}

export function renderPlan(plan: Plan): void {
  const { snapshot, recommended, rejected, rejectReason, risk } = plan;
  const { position: p, range } = snapshot;

  line(`  ${hr()}`);
  line();
  line(row("position", `${p.pool.token0.symbol} / ${p.pool.token1.symbol} ${(p.pool.feeTier / 10_000).toFixed(2)}%`));
  line(row("range", `${formatPrice(range.priceLower)} to ${formatPrice(range.priceUpper)}`,
    range.inRange ? muted("in range") : pinkDeep("out of range")));
  line(row("current", formatPrice(range.priceCurrent)));
  line();
  line(`  ${hr()}`);
  line();
  line(row("recommended", `${formatPrice(recommended.priceLower)} to ${formatPrice(recommended.priceUpper)}`,
    pink(recommended.kind)));
  if (rejected) {
    line(row("rejected", `${formatPrice(rejected.priceLower)} to ${formatPrice(rejected.priceUpper)}`,
      muted(rejected.kind)));
  }
  if (rejectReason) {
    line(row("reason", rejectReason));
  }
  line();
  line(row("confidence", `${risk.confidence.toFixed(2)}  ${verdictColor(risk.verdict)}`));
  if (risk.reasons.length) {
    for (const r of risk.reasons) {
      line(`  ${muted("·")} ${muted(r)}`);
    }
  }
  line();
  line(`  ${faint("plan id")} ${pink(plan.id)}    ${faint("zuno diff " + plan.id)}`);
  line();
}

export function renderDiff(diff: PlanDiff, plan: Plan): void {
  banner();
  line(header("zuno diff", diff.planId));
  line();
  const dec0 = plan.snapshot.position.pool.token0.decimals;
  const dec1 = plan.snapshot.position.pool.token1.decimals;
  const sym0 = plan.snapshot.position.pool.token0.symbol;
  const sym1 = plan.snapshot.position.pool.token1.symbol;

  line(`  ${muted("range")}`);
  line(`    ${muted("old")}  ${fg(`${formatPrice(diff.oldRange.priceLower)} to ${formatPrice(diff.oldRange.priceUpper)}`)}`);
  line(`    ${muted("new")}  ${fg(`${formatPrice(diff.newRange.priceLower)} to ${formatPrice(diff.newRange.priceUpper)}`)}  ${pink(plan.recommended.kind)}`);
  line();
  line(`  ${muted("token amounts")}`);
  line(`    ${muted("current".padEnd(10))} ${fg(formatAmount(diff.current.amount0, dec0))} ${muted(sym0)}   ${fg(formatAmount(diff.current.amount1, dec1))} ${muted(sym1)}`);
  line(`    ${muted("deploy".padEnd(10))} ${fg(formatAmount(diff.proposed.amount0, dec0))} ${muted(sym0)}   ${fg(formatAmount(diff.proposed.amount1, dec1))} ${muted(sym1)}`);
  line(`    ${muted("residual".padEnd(10))} ${fg(formatAmount(diff.residual.amount0, dec0))} ${muted(sym0)}   ${fg(formatAmount(diff.residual.amount1, dec1))} ${muted(sym1)}`);
  line();
  line(`  ${muted("risk")}  ${verdictColor(plan.risk.verdict)}`);
  line(`    ${muted(diff.riskNote)}`);
  line();
}

function verdictColor(v: string): string {
  if (v === "approve") return `${c.green}${v}${c.reset}`;
  if (v === "reject") return `${c.red}${v}${c.reset}`;
  return pink(v);
}

export function progressLine(stage: string, detail?: string): void {
  const [actor, action] = stage.split(".");
  line(`  ${mark} ${muted((actor ?? "").padEnd(8))} ${fg(action ?? "")} ${detail ? muted(detail) : ""}`);
}

export function planToDiff(plan: Plan): PlanDiff {
  return {
    planId: plan.id,
    oldRange: {
      tickLower: plan.snapshot.position.tickLower,
      tickUpper: plan.snapshot.position.tickUpper,
      priceLower: plan.snapshot.range.priceLower,
      priceUpper: plan.snapshot.range.priceUpper,
    },
    newRange: {
      tickLower: plan.recommended.tickLower,
      tickUpper: plan.recommended.tickUpper,
      priceLower: plan.recommended.priceLower,
      priceUpper: plan.recommended.priceUpper,
    },
    current: {
      amount0: plan.snapshot.position.amount0,
      amount1: plan.snapshot.position.amount1,
    },
    proposed: {
      amount0: plan.recommended.deploy0,
      amount1: plan.recommended.deploy1,
    },
    residual: {
      amount0: plan.recommended.residual0,
      amount1: plan.recommended.residual1,
    },
    riskNote: plan.rejectReason
      ? `${plan.risk.verdict} · ${plan.rejectReason}`
      : `${plan.risk.verdict} · ${plan.risk.reasons[0] ?? ""}`,
  };
}
