import assert from "node:assert/strict";
import test from "node:test";
import type { Holding } from "../src/lib/constants.ts";
import { isHolding } from "../src/lib/holding-validation.ts";

const validHolding: Holding = {
  id: "holding-1",
  platform: "Custom",
  assetName: "Example ETF",
  ticker: "EXAMPLE",
  assetClass: "ETFs",
  sector: "Diversified",
  geography: "US",
  risk: "Medium",
  quantity: 10,
  avgBuyPrice: 100,
  currentPrice: 105,
  currency: "USD",
  notes: "",
  priceSource: "alphavantage",
};

test("isHolding accepts a complete valid holding", () => {
  assert.equal(isHolding(validHolding), true);
});

test("isHolding rejects missing and incorrectly typed fields", () => {
  assert.equal(isHolding({ ...validHolding, ticker: 123 }), false);
  assert.equal(isHolding({ ...validHolding, quantity: Number.NaN }), false);
  assert.equal(isHolding({ ...validHolding, geography: "Mars" }), false);
});

test("isHolding validates optional purchases", () => {
  assert.equal(
    isHolding({
      ...validHolding,
      purchases: [{ quantity: 2, price: 90, date: "2026-01-02", fxRate: 3.67 }],
    }),
    true
  );
  assert.equal(
    isHolding({
      ...validHolding,
      purchases: [{ quantity: "2", price: 90, date: "2026-01-02" }],
    }),
    false
  );
});
