import test from "node:test";
import assert from "node:assert/strict";

import { scanArbitrage } from "../src/engines/arbitrage.js";
import { PaperTrader } from "../src/engines/paperTrader.js";

const book = (bestAsk, bestAskLiquidity = 100) => ({
  bestAsk,
  bestAskLiquidity,
});

test("case A: 0.97 pair is accepted with at most 2U", () => {
  const result = scanArbitrage({
    upBook: book(0.48), downBook: book(0.49), bankroll: 10,
  });
  assert.equal(result.opportunity, true);
  assert.ok(result.costUsd <= 2);
  assert.ok(result.estimatedProfitPct >= 1.2);
});

test("case B: 0.99 pair is rejected after safety thresholds", () => {
  const result = scanArbitrage({
    upBook: book(0.50), downBook: book(0.49), bankroll: 10,
  });
  assert.equal(result.opportunity, false);
  assert.equal(result.reason, "edge_too_small");
});

test("case C: combined price above one is rejected", () => {
  const result = scanArbitrage({
    upBook: book(0.51), downBook: book(0.50), bankroll: 10,
  });
  assert.equal(result.opportunity, false);
  assert.equal(result.reason, "combined_price_not_arbitrage");
});

test("case D: 5U bankroll preserves 4U and invests at most 1U", () => {
  const result = scanArbitrage({
    upBook: book(0.48), downBook: book(0.49), bankroll: 5,
  });
  assert.equal(result.opportunity, true);
  assert.ok(result.costUsd <= 1);
});

test("case E: bankroll at reserve stops new trades", () => {
  const result = scanArbitrage({
    upBook: book(0.48), downBook: book(0.49), bankroll: 4,
  });
  assert.equal(result.opportunity, false);
  assert.equal(result.reason, "no_paper_cash");
});

test("missing liquidity, invalid prices, and unsafe legacy limits are rejected", () => {
  assert.equal(scanArbitrage({
    upBook: { bestAsk: 0.48 }, downBook: book(0.49), bankroll: 10,
  }).reason, "insufficient_liquidity");
  assert.equal(scanArbitrage({
    upBook: book(null), downBook: book(0.49), bankroll: 10,
  }).reason, "missing_orderbook");

  const legacy = scanArbitrage({
    upBook: book(0.48), downBook: book(0.49), bankroll: 10,
    maxTradeUsd: 5, minProfitPct: 1, safetyBufferPct: 0.3,
  });
  assert.equal(legacy.opportunity, true);
  assert.ok(legacy.costUsd <= 2);
  assert.equal(legacy.executionBufferPct, 1.3);
});

test("PaperTrader preserves reserve and rejects duplicate markets", () => {
  const trader = new PaperTrader({ startingBalance: 5, maxTradeUsd: 5 });
  assert.equal(trader.canTrade(1), true);
  assert.equal(trader.canTrade(1.01), false);

  const trade = {
    key: "market-1", costUsd: 1, settlementValue: 1.03,
    estimatedProfitUsd: 0.017, estimatedProfitPct: 1.7,
  };
  assert.equal(trader.recordArbitrage(trade).ok, true);
  assert.equal(trader.recordArbitrage(trade).reason, "duplicate_opportunity");
});
