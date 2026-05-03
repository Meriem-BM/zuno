import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Address, PositionAlert } from "@zuno/core";
import { createTelegramNotifier, formatTelegramAlert } from "../../src/monitor/notifier.js";

const alert: PositionAlert = {
  id: "alert_test",
  walletAddress: "0x111111111111111111111111111111111111abcd" as Address,
  chainId: 8453,
  positionId: "42",
  severity: "critical",
  kind: "out_of_range",
  reason: "out of range",
  message: "WETH/USDC position 42 is out of range: out of range",
  createdAt: 1,
};

describe("Telegram monitor notifier", () => {
  it("formats a compact HTML alert", () => {
    const text = formatTelegramAlert(alert);
    assert.match(text, /Zuno LP alert/u);
    assert.match(text, /Base/u);
    assert.match(text, /0x1111\.\.\.abcd/u);
    assert.match(text, /position: <code>42<\/code>/u);
  });

  it("is disabled when Telegram config is missing", async () => {
    const notifier = createTelegramNotifier({ config: null });
    assert.equal(notifier.enabled, false);
    await notifier.send(alert);
  });

  it("sends alerts through Telegram sendMessage", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const notifier = createTelegramNotifier({
      config: {
        botToken: "bot_secret",
        chatId: "1234",
        apiBaseUrl: "https://telegram.test",
      },
      fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    await notifier.send(alert);

    assert.equal(notifier.enabled, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "https://telegram.test/botbot_secret/sendMessage");
    const body = JSON.parse(String(calls[0]!.init.body)) as { chat_id: string; text: string };
    assert.equal(body.chat_id, "1234");
    assert.match(body.text, /CRITICAL/u);
  });

  it("fails clearly when Telegram rejects the message", async () => {
    const notifier = createTelegramNotifier({
      config: {
        botToken: "bot_secret",
        chatId: "1234",
        apiBaseUrl: "https://telegram.test",
      },
      fetchImpl: async () => new Response("bad chat", { status: 400 }),
    });

    await assert.rejects(() => notifier.send(alert), /Telegram send failed: 400 bad chat/u);
  });
});
