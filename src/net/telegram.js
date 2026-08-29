// src/net/telegram.js

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendTelegramMessage(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return {
      ok: false,
      reason: "telegram_not_configured",
    };
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json();

    if (!data?.ok) {
      return {
        ok: false,
        reason: data?.description || "telegram_api_error",
      };
    }

    return {
      ok: true,
      result: data.result,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err?.message || String(err),
    };
  }
}

export function formatArbitrageMessage({
  market = "BTC 5m",
  opportunity,
  tradeResult,
}) {
  const stats = tradeResult?.stats;
  const trade = tradeResult?.trade;

  return [
    "🟢 Polymarket 模拟套利",
    "",
    `市场: ${market}`,
    `UP Ask: ${opportunity.upAsk.toFixed(4)}`,
    `DOWN Ask: ${opportunity.downAsk.toFixed(4)}`,
    `合计: ${opportunity.combinedPrice.toFixed(4)}`,
    "",
    `模拟投入: $${opportunity.costUsd.toFixed(2)}`,
    `预计收益: $${opportunity.estimatedProfitUsd.toFixed(4)}`,
    `预计收益率: ${opportunity.estimatedProfitPct.toFixed(2)}%`,
    "",
    trade
      ? `模拟实际利润: $${trade.realizedProfitUsd.toFixed(4)}`
      : null,
    stats
      ? `模拟余额: $${stats.balance.toFixed(2)}`
      : null,
    stats
      ? `累计PnL: $${stats.totalProfit.toFixed(4)}`
      : null,
    stats
      ? `模拟交易次数: ${stats.totalTrades}`
      : null,
    "",
    "⚠️ Paper Trading，仅模拟，不会真实下单。",
  ]
    .filter(Boolean)
    .join("\n");
}