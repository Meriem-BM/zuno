import { chainName, defaultChainId, monitorIntervalMs } from "@zuno/chain/config";
import { newAlertId, type Address, type MonitorReport, type PositionAlert } from "@zuno/core";
import { defaultAlertStore } from "@zuno/storage";
import { loadSession } from "@zuno/chain/wallet";
import {
  buildSnapshot,
  isRiskyPosition,
  listPositions,
  pairName,
  rangeStatus,
  riskReason,
} from "@zuno/chain/uniswap";
import { isAddress } from "viem";
import { makeLogger } from "../shared/log.js";
import { createTelegramNotifier } from "./notifier.js";

const log = makeLogger("watcher");
const alertStore = defaultAlertStore();
const notifier = createTelegramNotifier();

const wallet = await readWallet();
const chainId = defaultChainId();
const intervalMs = monitorIntervalMs();

log(
  `monitor online  zuno_wallet=${shortAddr(wallet)}  chain=${chainName(chainId)}  interval=${intervalMs}ms`,
);
log(`notifications  telegram=${notifier.enabled ? "enabled" : "disabled"}`);

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
    await notify(alert);
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

async function notify(alert: PositionAlert): Promise<void> {
  if (!notifier.enabled) return;
  try {
    await notifier.send(alert);
    log(`telegram sent  ${alert.positionId}  ${alert.id}`);
  } catch (error) {
    log(`telegram error  ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readWallet(): Promise<Address> {
  const session = await loadSession();
  const fromSession = session?.agentWalletAddress;
  if (fromSession && isAddress(fromSession)) return fromSession as Address;
  const fromEnv = process.env.ZUNO_AGENT_WALLET_ADDRESS;
  if (fromEnv && isAddress(fromEnv)) return fromEnv as Address;
  throw new Error(
    "Sign in via the CLI first or set ZUNO_AGENT_WALLET_ADDRESS to run the Zuno wallet monitor.",
  );
}

function shortAddr(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
