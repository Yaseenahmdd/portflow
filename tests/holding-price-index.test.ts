import assert from "node:assert/strict";
import test from "node:test";
import type { Holding } from "../src/lib/constants.ts";
import {
  buildHoldingPriceIndexes,
  getPriceIndexes,
  updateHoldingsAtIndexes,
} from "../src/lib/dashboard/holding-price-index.ts";

function createHolding(overrides: Partial<Holding>): Holding {
  return {
    id: crypto.randomUUID(),
    platform: "Custom",
    assetName: "Test holding",
    ticker: "",
    assetClass: "Stocks",
    sector: "",
    geography: "US",
    risk: "Medium",
    quantity: 1,
    avgBuyPrice: 1,
    currentPrice: 1,
    currency: "USD",
    notes: "",
    priceSource: "manual",
    ...overrides,
  };
}

test("price indexes retain every holding with the same market identifier", () => {
  const holdings = [
    createHolding({ platform: "Groww", ticker: "NSE:HDFCAMC", geography: "India", priceSource: "alphavantage" }),
    createHolding({ platform: "Custom", ticker: "hdfcamc", geography: "India", priceSource: "alphavantage" }),
    createHolding({ platform: "IG", ticker: "HDFCAMC", geography: "US", priceSource: "alphavantage" }),
  ];

  const indexes = buildHoldingPriceIndexes(holdings);

  assert.deepEqual(getPriceIndexes(indexes.indianStocks, "HDFCAMC"), [0, 1]);
  assert.deepEqual(getPriceIndexes(indexes.usStocks, "HDFCAMC"), [2]);
});

test("price updates apply to all matching holding indexes", () => {
  const holdings = [
    createHolding({ ticker: "BTC", assetClass: "Crypto", priceSource: "coingecko" }),
    createHolding({ ticker: "btc", assetClass: "Crypto", priceSource: "coingecko" }),
  ];
  const indexes = buildHoldingPriceIndexes(holdings);
  const updated = [...holdings];

  updateHoldingsAtIndexes(updated, getPriceIndexes(indexes.crypto, "BTC"), (holding) => ({
    ...holding,
    currentPrice: 123,
  }));

  assert.deepEqual(updated.map((holding) => holding.currentPrice), [123, 123]);
});
