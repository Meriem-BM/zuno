import { chainName, telegramConfig, type TelegramConfig } from "@zuno/chain/config";
import type { PositionAlert } from "@zuno/core";

export interface TelegramNotifierOptions {
  config?: TelegramConfig | null;
  fetchImpl?: typeof fetch;
}

export interface AlertNotifier {
  enabled: boolean;
  send(alert: PositionAlert): Promise<void>;
}

export function createTelegramNotifier(options: TelegramNotifierOptions = {}): AlertNotifier {
  const config = options.config === undefined ? telegramConfig() : options.config;
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!config) return { enabled: false, async send() {} };

  return {
    enabled: true,
    async send(alert) {
      const url = `${config.apiBaseUrl.replace(/\/$/u, "")}/bot${config.botToken}/sendMessage`;
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: formatTelegramAlert(alert),
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      if (!res.ok) {
        const body = await safeBody(res);
        throw new Error(`Telegram send failed: ${res.status}${body ? ` ${body}` : ""}`);
      }
    },
  };
}

export function formatTelegramAlert(alert: PositionAlert): string {
  const severity = alert.severity === "critical" ? "CRITICAL" : alert.severity.toUpperCase();
  return [
    `<b>Zuno LP alert</b>`,
    `severity: <b>${escapeHtml(severity)}</b>`,
    `chain: ${escapeHtml(chainName(alert.chainId))}`,
    `wallet: <code>${escapeHtml(shortAddr(alert.walletAddress))}</code>`,
    `position: <code>${escapeHtml(alert.positionId)}</code>`,
    `condition: ${escapeHtml(alert.kind.replaceAll("_", " "))}`,
    `reason: ${escapeHtml(alert.reason)}`,
    "",
    escapeHtml(alert.message),
  ].join("\n");
}

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 240);
  } catch {
    return "";
  }
}

function shortAddr(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
