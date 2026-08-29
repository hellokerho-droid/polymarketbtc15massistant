// src/engines/paperTrader.js
// Simulation-only paper trader. Never places real orders.

export class PaperTrader {
  constructor({
    startingBalance = 100,
    maxTradeUsd = 5,
  } = {}) {
    this.startingBalance = startingBalance;
    this.balance = startingBalance;
    this.maxTradeUsd = maxTradeUsd;

    this.totalTrades = 0;
    this.totalProfit = 0;

    this.openKeys = new Set();
    this.history = [];
  }

  canTrade(costUsd) {
    return (
      Number.isFinite(costUsd) &&
      costUsd > 0 &&
      costUsd <= this.balance &&
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

    if (!this.canTrade(costUsd)) {
      return {
        ok: false,
        reason: "insufficient_paper_balance",
      };
    }

    this.openKeys.add(key);

    // Paper simulation assumes both legs fill and later settle.
    this.balance -= costUsd;
    this.balance += settlementValue;

    const realizedProfit = settlementValue - costUsd;

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