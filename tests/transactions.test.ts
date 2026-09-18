import assert from "node:assert/strict";
import test from "node:test";
import {
  getTransactionAmount,
  normalizeTransaction,
  validateTransaction,
  type PortfolioTransaction,
} from "../src/lib/transactions.ts";

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
