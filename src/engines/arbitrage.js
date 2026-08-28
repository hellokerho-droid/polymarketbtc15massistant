// src/engines/arbitrage.js
// Paper-only arbitrage scanner. Does NOT place real orders.

import { PAPER_SAFETY } from "../config/paperSafety.js";

export function scanArbitrage({
  upBook,
  downBook,
  bankroll = PAPER_SAFETY.startingBalance,
  maxTradeUsd = PAPER_SAFETY.maxTradeUsd,
  cashReserveUsd = PAPER_SAFETY.cashReserveUsd,
  minGrossProfitPct = PAPER_SAFETY.minGrossProfitPct,
  executionBufferPct = PAPER_SAFETY.executionBufferPct,
  minNetProfitPct = PAPER_SAFETY.minNetProfitPct,
}) {
  const upAsk = Number(upBook?.bestAsk);
  const downAsk = Number(downBook?.bestAsk);

  if (
    !Number.isFinite(upAsk) ||
    !Number.isFinite(downAsk) ||
    upAsk <= 0 ||
    downAsk <= 0
  ) {
    return {
      opportunity: false,
      reason: "missing_orderbook",
    };
  }

  const combinedPrice = upAsk + downAsk;

  if (!Number.isFinite(combinedPrice) || combinedPrice >= 1) {
    return { opportunity: false, reason: "combined_price_not_arbitrage" };
  }

  // One matched UP + DOWN pair settles to $1 total.
  const grossEdge = 1 - combinedPrice;
  const grossProfitPct = (grossEdge / combinedPrice) * 100;

  // V1 safety buffer for execution uncertainty.
  // This is deliberately conservative and is NOT a guarantee
  // that a live trade would be profitable.
  const safeMaxTradeUsd = Math.min(Number(maxTradeUsd) || 0, 2);
  const safeReserveUsd = Math.max(Number(cashReserveUsd) || 0, 4);
  const safeMinGrossPct = Math.max(Number(minGrossProfitPct) || 0, 2.5);
  const safeExecutionBufferPct = Math.max(Number(executionBufferPct) || 0, 1.3);
  const safeMinNetPct = Math.max(Number(minNetProfitPct) || 0, 1.2);
  const netProfitPct = grossProfitPct - safeExecutionBufferPct;

  if (grossProfitPct < safeMinGrossPct || netProfitPct < safeMinNetPct) {
    return {
      opportunity: false,
      reason: "edge_too_small",
      upAsk,
      downAsk,
      combinedPrice,
      grossProfitPct,
      netProfitPct,
    };
  }

  const availableCash = Math.max(0, (Number(bankroll) || 0) - safeReserveUsd);
  const tradeBudget = Math.min(safeMaxTradeUsd, availableCash);

  if (tradeBudget <= 0) {
    return {
      opportunity: false,
      reason: "no_paper_cash",
    };
  }

  // Spend equal contract quantity on both outcomes.
  const pairQty = tradeBudget / combinedPrice;

  // If summarizeOrderBook exposes ask-side liquidity, limit
  // the paper fill to the available size.
  // Liquidity is contract quantity, not USD. Only liquidity offered at the
  // quoted best ask can safely be costed at bestAsk.
  const upAskSize = Number(upBook?.bestAskLiquidity ?? upBook?.askLiquidity);
  const downAskSize = Number(downBook?.bestAskLiquidity ?? downBook?.askLiquidity);

  if (
    !Number.isFinite(upAskSize) || upAskSize <= 0 ||
    !Number.isFinite(downAskSize) || downAskSize <= 0
  ) {
    return { opportunity: false, reason: "insufficient_liquidity" };
  }

  const executableQty = Math.min(
    pairQty,
    upAskSize,
    downAskSize,
  );

  if (!Number.isFinite(executableQty) || executableQty <= 0) {
    return {
      opportunity: false,
      reason: "insufficient_liquidity",
    };
  }

  const actualCost = executableQty * combinedPrice;
  const settlementValue = executableQty;
  const grossProfitUsd = settlementValue - actualCost;

  // Apply the same conservative buffer to the paper result.
  const safetyCostUsd = actualCost * (safeExecutionBufferPct / 100);
  const estimatedProfitUsd = grossProfitUsd - safetyCostUsd;

  if (estimatedProfitUsd <= 0) {
    return {
      opportunity: false,
      reason: "not_profitable_after_buffer",
    };
  }

  return {
    opportunity: true,

    upAsk,
    downAsk,
    combinedPrice,

    grossProfitPct,
    executionBufferPct: safeExecutionBufferPct,
    netProfitPct,
    estimatedProfitPct:
      (estimatedProfitUsd / actualCost) * 100,

    quantity: executableQty,
    costUsd: actualCost,
    settlementValue,
    estimatedProfitUsd,
  };
}
