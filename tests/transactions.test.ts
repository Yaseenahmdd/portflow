import assert from "node:assert/strict";
import test from "node:test";
import {
  getTransactionAmount,
  normalizeTransaction,
  transactionsFromHoldingPurchases,
  validateTransaction,
  type PortfolioTransaction,
} from "../src/lib/transactions.ts";
import type { Holding } from "../src/lib/constants.ts";

function transaction(overrides: Partial<PortfolioTransaction> = {}): PortfolioTransaction {
  return {
    id: "transaction-1",
    type: "buy",
    date: "2026-09-18",
    platform: "IBKR",
    assetName: "Example",
    ticker: "EX",
    currency: "USD",
    quantity: 2,
    price: 10,
    fees: 1,
    notes: "",
    ...overrides,
  };
}

test("buy transactions require an asset, quantity, and price", () => {
  assert.equal(validateTransaction(transaction()), null);
  assert.match(validateTransaction(transaction({ quantity: 0 })) || "", /quantity/);
  assert.match(validateTransaction(transaction({ assetName: "", holdingId: undefined })) || "", /asset/);
});

test("FX transactions require different currencies and both amounts", () => {
  const valid = transaction({
    type: "fx",
    assetName: "",
    ticker: "",
    amount: 100,
    quantity: undefined,
    price: undefined,
    targetCurrency: "AED",
    targetAmount: 367.25,
  });
  assert.equal(validateTransaction(valid), null);
  assert.match(validateTransaction({ ...valid, targetCurrency: "USD" }) || "", /different/);
});

test("transaction normalization trims text and uppercases tickers", () => {
  const normalized = normalizeTransaction(transaction({ ticker: " aapl ", notes: " note " }));
  assert.equal(normalized.ticker, "AAPL");
  assert.equal(normalized.notes, "note");
});

test("buy transaction amount includes fees", () => {
  assert.equal(getTransactionAmount(transaction()), 21);
});

function holding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: "holding-1",
    platform: "Zerodha",
    assetName: "Example India",
    ticker: "EXAMPLE",
    assetClass: "Stocks",
    sector: "Technology",
    geography: "India",
    risk: "High",
    quantity: 5,
    avgBuyPrice: 100,
    currentPrice: 110,
    currency: "INR",
    notes: "",
    priceSource: "manual",
    purchases: [{ quantity: 5, price: 100, date: "2026-09-01", fxRate: 0.044 }],
    ...overrides,
  };
}

test("holding purchases convert to linked buy transactions", () => {
  const [converted] = transactionsFromHoldingPurchases([holding()]);

  assert.equal(converted.type, "buy");
  assert.equal(converted.holdingId, "holding-1");
  assert.equal(converted.quantity, 5);
  assert.equal(converted.price, 100);
  assert.equal(converted.date, "2026-09-01");
  assert.equal(converted.fxRateToAed, 0.044);
});

test("holding purchase import IDs are deterministic and distinguish duplicate batches", () => {
  const source = holding({
    purchases: [
      { quantity: 5, price: 100, date: "2026-09-01" },
      { quantity: 5, price: 100, date: "2026-09-01" },
    ],
  });
  const first = transactionsFromHoldingPurchases([source]);
  const second = transactionsFromHoldingPurchases([source]);

  assert.deepEqual(first.map(({ id }) => id), second.map(({ id }) => id));
  assert.notEqual(first[0].id, first[1].id);
});

test("purchase import skips invalid history and holdings without purchases", () => {
  const converted = transactionsFromHoldingPurchases([
    holding({ purchases: undefined }),
    holding({
      id: "holding-2",
      purchases: [
        { quantity: 0, price: 100, date: "2026-09-01" },
        { quantity: 1, price: 100, date: "not-a-date" },
      ],
    }),
  ]);

  assert.deepEqual(converted, []);
});

test("purchase import only preserves historical FX for INR holdings", () => {
  const [converted] = transactionsFromHoldingPurchases([
    holding({ currency: "USD", purchases: [{ quantity: 1, price: 10, date: "2026-09-01", fxRate: 3.67 }] }),
  ]);

  assert.equal(converted.fxRateToAed, undefined);
});
