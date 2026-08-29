// src/engines/paperTrader.js
// Simulation-only paper trader. Never places real orders.

import { PAPER_SAFETY } from "../config/paperSafety.js";

export class PaperTrader {
  constructor({
    startingBalance = PAPER_SAFETY.startingBalance,
    maxTradeUsd = PAPER_SAFETY.maxTradeUsd,
    cashReserveUsd = PAPER_SAFETY.cashReserveUsd,
  } = {}) {
    this.startingBalance = Number.isFinite(Number(startingBalance)) && Number(startingBalance) > 0
      ? Number(startingBalance) : 10;
    this.balance = this.startingBalance;
    this.maxTradeUsd = Math.min(Number(maxTradeUsd) || 2, 2);
    this.cashReserveUsd = Math.max(Number(cashReserveUsd) || 4, 4);

    this.totalTrades = 0;
    this.totalProfit = 0;

    this.openKeys = new Set();
    this.history = [];
  }

  canTrade(costUsd) {
    return (
      Number.isFinite(costUsd) &&
      costUsd > 0 &&
      costUsd <= this.balance - this.cashReserveUsd &&
      costUsd <= this.maxTradeUsd
    );
  }

  hasSeen(key) {
    return this.openKeys.has(key);
  }

  recordArbitrage({
    key,
    market = "BTC 5m",
    upAsk,
    downAsk,
    quantity,
    costUsd,
    settlementValue,
    estimatedProfitUsd,
    estimatedProfitPct,
  }) {
    if (!key) {
      return {
        ok: false,
        reason: "missing_key",
      };
    }

    if (this.hasSeen(key)) {
      return {
        ok: false,
        reason: "duplicate_opportunity",
      };
    }

    if (!Number.isFinite(estimatedProfitUsd) || estimatedProfitUsd <= 0) {
      return {
        ok: false,
        reason: "invalid_estimated_profit",
      };
    }

    if (!this.canTrade(costUsd)) {
      return {
        ok: false,
        reason: "insufficient_paper_balance",
      };
    }

    this.openKeys.add(key);

    // Paper simulation assumes both legs fill and later settle.
    this.balance -= costUsd;
    // Record the conservative net estimate, not an unrealistically buffer-free
    // settlement. This remains an in-memory simulation only.
    this.balance += costUsd + estimatedProfitUsd;

    const realizedProfit = estimatedProfitUsd;

    this.totalTrades += 1;
    this.totalProfit += realizedProfit;

    const trade = {
      time: new Date().toISOString(),
      market,
      key,

      upAsk,
      downAsk,
      quantity,

      costUsd,
      settlementValue,

      realizedProfitUsd: realizedProfit,
      estimatedProfitUsd,
      estimatedProfitPct,

      balanceAfter: this.balance,
    };

    this.history.push(trade);

    return {
      ok: true,
      trade,
      stats: this.getStats(),
    };
  }

  getStats() {
    return {
      startingBalance: this.startingBalance,
      balance: this.balance,
      totalTrades: this.totalTrades,
      totalProfit: this.totalProfit,
      returnPct:
        ((this.balance - this.startingBalance) /
          this.startingBalance) *
        100,
    };
  }
}
