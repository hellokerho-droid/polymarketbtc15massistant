// Central, paper-only risk limits. Environment variables may make the limits
// stricter, but can never weaken the 10U safety profile.

function positiveEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const PAPER_SAFETY = Object.freeze({
  startingBalance: positiveEnv("PAPER_STARTING_BALANCE", 10),
  maxTradeUsd: Math.min(positiveEnv("PAPER_MAX_TRADE_USD", 2), 2),
  cashReserveUsd: Math.max(positiveEnv("PAPER_CASH_RESERVE_USD", 4), 4),
  minGrossProfitPct: Math.max(
    positiveEnv("PAPER_MIN_GROSS_PROFIT_PCT", 2.5),
    2.5,
  ),
  executionBufferPct: Math.max(
    positiveEnv("PAPER_EXECUTION_BUFFER_PCT", 1.3),
    1.3,
  ),
  minNetProfitPct: Math.max(
    positiveEnv("PAPER_MIN_NET_PROFIT_PCT", 1.2),
    1.2,
  ),
});
