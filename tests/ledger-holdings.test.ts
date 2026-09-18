import assert from "node:assert/strict";
import test from "node:test";
import type { Holding } from "../src/lib/constants.ts";
import { reconcileHoldingsFromLedger } from "../src/lib/ledger-holdings.ts";
import type { PortfolioTransaction } from "../src/lib/transactions.ts";

function holding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: "holding-1",
    platform: "IBKR",
    assetName: "Example",
    ticker: "EX",
    assetClass: "Stocks",
    sector: "Technology",
    geography: "US",
    risk: "High",
    quantity: 0,
    avgBuyPrice: 0,
    currentPrice: 20,
    currency: "USD",
    notes: "",
    priceSource: "alphavantage",
    ...overrides,
  };
}

function transaction(
  id: string,
  type: PortfolioTransaction["type"],
  overrides: Partial<PortfolioTransaction> = {}
): PortfolioTransaction {
  return {
    id,
    type,
    date: "2026-01-01",
    holdingId: "holding-1",
    platform: "IBKR",
    assetName: "Example",
    ticker: "EX",
    currency: "USD",
    quantity: 1,
    price: 10,
    notes: "",
    ...overrides,
  };
}

test("ledger buys calculate quantity and weighted average cost", () => {
  const result = reconcileHoldingsFromLedger(
    [holding()],
    [
      transaction("buy-1", "buy", { quantity: 2, price: 10 }),
      transaction("buy-2", "buy", { date: "2026-02-01", quantity: 1, price: 16 }),
    ],
    0.044
  );

  assert.equal(result.nextHoldings[0].quantity, 3);
  assert.equal(result.nextHoldings[0].avgBuyPrice, 12);
  assert.equal(result.nextHoldings[0].purchases?.length, 2);
  assert.deepEqual(result.issues, []);
});

test("ledger sells reduce quantity and calculate realized gain with average cost", () => {
  const result = reconcileHoldingsFromLedger(
    [holding()],
    [
      transaction("buy-1", "buy", { quantity: 2, price: 10 }),
      transaction("sell-1", "sell", { date: "2026-02-01", quantity: 1, price: 15, fees: 1 }),
    ],
    0.044
  );

  assert.equal(result.nextHoldings[0].quantity, 1);
  assert.equal(result.nextHoldings[0].avgBuyPrice, 10);
  assert.equal(result.realizedGainAed, 4 * 3.6725);
});

test("ledger blocks sells that exceed the available quantity", () => {
  const current = holding({ quantity: 2, avgBuyPrice: 10 });
  const result = reconcileHoldingsFromLedger(
    [current],
    [
      transaction("buy-1", "buy", { quantity: 1, price: 10 }),
      transaction("sell-1", "sell", { date: "2026-02-01", quantity: 2, price: 15 }),
    ],
    0.044
  );

  assert.equal(result.issues.length, 1);
  assert.equal(result.nextHoldings[0], current);
});

test("unlinked asset activity is reported and never changes holdings", () => {
  const current = holding({ quantity: 2, avgBuyPrice: 10 });
  const result = reconcileHoldingsFromLedger(
    [current],
    [transaction("buy-1", "buy", { holdingId: undefined })],
    0.044
  );

  assert.match(result.issues[0].message, /linked/);
  assert.equal(result.nextHoldings[0], current);
});

test("previously managed holdings return to zero after their last transaction is removed", () => {
  const result = reconcileHoldingsFromLedger(
    [holding({ quantity: 2, avgBuyPrice: 10 })],
    [],
    0.044,
    ["holding-1"]
  );

  assert.equal(result.nextHoldings[0].quantity, 0);
  assert.equal(result.nextHoldings[0].avgBuyPrice, 0);
});

test("stock splits adjust quantity and per-unit average cost", () => {
  const result = reconcileHoldingsFromLedger(
    [holding()],
    [
      transaction("buy-1", "buy", { quantity: 2, price: 10 }),
      transaction("split-1", "split", { date: "2026-02-01", quantity: undefined, price: undefined, splitRatio: 2 }),
    ],
    0.044
  );

  assert.equal(result.nextHoldings[0].quantity, 4);
  assert.equal(result.nextHoldings[0].avgBuyPrice, 5);
});
