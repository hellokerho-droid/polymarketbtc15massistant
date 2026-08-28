// src/engines/arbitrage.js
// Paper-only arbitrage scanner. Does NOT place real orders.

export function scanArbitrage({
  upBook,
  downBook,
  bankroll = 100,
  maxTradeUsd = 5,
  minProfitPct = 1.0,
  safetyBufferPct = 0.3,
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

  // One matched UP + DOWN pair settles to $1 total.
  const grossEdge = 1 - combinedPrice;
  const grossProfitPct = (grossEdge / combinedPrice) * 100;

  // V1 safety buffer for execution uncertainty.
  // This is deliberately conservative and is NOT a guarantee
  // that a live trade would be profitable.
  const netProfitPct = grossProfitPct - safetyBufferPct;

  if (netProfitPct < minProfitPct) {
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

  const availableCash = Math.max(0, Number(bankroll) || 0);
  const tradeBudget = Math.min(maxTradeUsd, availableCash);

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
  const upAskSize = Number(upBook?.askLiquidity ?? Infinity);
const downAskSize = Number(downBook?.askLiquidity ?? Infinity);

  const executableQty = Math.min(
    pairQty,
    Number.isFinite(upAskSize) ? upAskSize : pairQty,
    Number.isFinite(downAskSize) ? downAskSize : pairQty
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
  const safetyCostUsd = actualCost * (safetyBufferPct / 100);
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
    estimatedProfitPct:
      (estimatedProfitUsd / actualCost) * 100,

    quantity: executableQty,
    costUsd: actualCost,
    settlementValue,
    estimatedProfitUsd,
  };
}