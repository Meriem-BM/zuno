import { chainName, configuredWatchAddress, defaultChainId, monitorIntervalMs } from "@zuno/config";
import { newAlertId, type Address, type MonitorReport, type PositionAlert } from "@zuno/core";
import { defaultAlertStore } from "@zuno/storage";
import {
  buildSnapshot,
  isRiskyPosition,
  listPositions,
  pairName,
  rangeStatus,
  riskReason,
} from "@zuno/uniswap";
import { isAddress } from "viem";
import { makeLogger } from "../shared/log.js";

const log = makeLogger("watcher");
const alertStore = defaultAlertStore();

const wallet = readWallet();
const chainId = defaultChainId();
const intervalMs = monitorIntervalMs();

log(
  `monitor online  wallet=${shortAddr(wallet)}  chain=${chainName(chainId)}  interval=${intervalMs}ms`,
);

await checkOnce();
setInterval(() => {
  void checkOnce().catch((error) => {
    log(`monitor error  ${error instanceof Error ? error.message : String(error)}`);
  });
}, intervalMs);

async function checkOnce(): Promise<MonitorReport> {
  const positions = await listPositions(wallet, { chainId });
  const alerts: PositionAlert[] = [];

  for (const position of positions) {
    const snapshot = buildSnapshot(position);
    if (!isRiskyPosition(snapshot)) continue;

    const kind = snapshot.range.inRange ? "near_boundary" : "out_of_range";
    const severity = snapshot.range.inRange ? "warning" : "critical";
    const reason = riskReason(snapshot);
    const previous = await alertStore.latestForPosition(position.id);
    if (
      previous &&
      !previous.acknowledgedAt &&
      previous.kind === kind &&
      previous.reason === reason
    ) {
      continue;
    }

    const alert: PositionAlert = {
      id: newAlertId(),
      walletAddress: wallet,
      chainId,
      positionId: position.id,
      severity,
      kind,
      reason,
      message: `${pairName(position)} position ${position.id} is ${rangeStatus(snapshot).toLowerCase().replace("_", " ")}: ${reason}`,
      createdAt: Date.now(),
    };
    await alertStore.save(alert);
    alerts.push(alert);
    log(`alert  ${alert.severity}  ${alert.positionId}  ${alert.reason}`);
  }

  const report: MonitorReport = {
    walletAddress: wallet,
    chainId,
    checkedAt: Date.now(),
    positionCount: positions.length,
    alertCount: alerts.length,
    alerts,
  };
  log(`checked  positions=${report.positionCount}  new_alerts=${report.alertCount}`);
  return report;
}

function readWallet(): Address {
  const raw = configuredWatchAddress();
  if (!raw || !isAddress(raw)) {
    throw new Error("Set ZUNO_WATCH_ADDRESS to run the Zuno monitor.");
  }
  return raw;
}

function shortAddr(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
