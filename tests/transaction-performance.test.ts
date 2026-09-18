import assert from "node:assert/strict";
import test from "node:test";
import { getTransactionPerformance } from "../src/lib/transaction-performance.ts";
import type { PortfolioTransaction } from "../src/lib/transactions.ts";

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

test("transaction performance calculates realized gain using average cost", () => {
  const performance = getTransactionPerformance(
    [
      transaction("buy-1", "buy", { quantity: 2, price: 10 }),
      transaction("buy-2", "buy", { date: "2026-01-02", quantity: 2, price: 20 }),
      transaction("sell-1", "sell", { date: "2026-02-01", quantity: 2, price: 25, fees: 1 }),
    ],
    { inrToAedRate: 0.044 }
  );

  assert.equal(performance.realizedGainAed, 19 * 3.6725);
  assert.equal(performance.soldCostBasisAed, 30 * 3.6725);
  assert.equal(performance.tradeFeesAed, 3.6725);
});

test("dividends use transaction FX and group income by asset", () => {
  const performance = getTransactionPerformance(
    [
      transaction("dividend-1", "dividend", {
        currency: "INR",
        amount: 100,
        quantity: undefined,
        price: undefined,
        fxRateToAed: 0.045,
      }),
      transaction("dividend-2", "dividend", {
        date: "2026-02-01",
        currency: "INR",
        amount: 50,
        quantity: undefined,
        price: undefined,
        fxRateToAed: 0.046,
      }),
    ],
    { inrToAedRate: 0.044 }
  );

  assert.equal(performance.dividendIncomeAed, 6.8);
  assert.equal(performance.incomeSources[0].count, 2);
});

test("date ranges include prior buys for cost basis but only count in-range results", () => {
  const performance = getTransactionPerformance(
    [
      transaction("buy-1", "buy", { date: "2026-01-01", quantity: 2, price: 10 }),
      transaction("sell-1", "sell", { date: "2026-03-01", quantity: 1, price: 15 }),
    ],
    { startDate: "2026-02-01", endDate: "2026-03-31", inrToAedRate: 0.044 }
  );

  assert.equal(performance.realizedGainAed, 5 * 3.6725);
  assert.equal(performance.tradeFeesAed, 0);
  assert.equal(performance.activityCount, 1);
});

test("cash flow and standalone fees are reported separately", () => {
  const performance = getTransactionPerformance(
    [
      transaction("deposit-1", "deposit", { currency: "AED", amount: 1000, quantity: undefined, price: undefined }),
      transaction("withdrawal-1", "withdrawal", { currency: "AED", amount: 200, quantity: undefined, price: undefined }),
      transaction("fee-1", "fee", { currency: "AED", amount: 10, quantity: undefined, price: undefined }),
    ],
    { inrToAedRate: 0.044 }
  );

  assert.equal(performance.netCashFlowAed, 800);
  assert.equal(performance.standaloneFeesAed, 10);
  assert.equal(performance.totalFeesAed, 10);
});

test("oversells are excluded and reported", () => {
  const performance = getTransactionPerformance(
    [transaction("sell-1", "sell", { quantity: 2, price: 15 })],
    { inrToAedRate: 0.044 }
  );

  assert.equal(performance.realizedGainAed, 0);
  assert.equal(performance.issues.length, 1);
});
