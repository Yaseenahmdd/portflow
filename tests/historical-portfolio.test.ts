import assert from "node:assert/strict";
import test from "node:test";
import type { Holding } from "../src/lib/constants.ts";
import {
  buildHistoricalPortfolioSnapshots,
  getHistoricalPortfolioStartDate,
} from "../src/lib/historical-portfolio.ts";

function holding(overrides: Partial<Holding>): Holding {
  return {
    id: "holding-1",
    platform: "Custom",
    assetName: "Example",
    ticker: "EXAMPLE",
    assetClass: "Stocks",
    sector: "Other",
    geography: "UAE",
    risk: "Medium",
    quantity: 0,
    avgBuyPrice: 0,
    currentPrice: 0,
    currency: "AED",
    notes: "",
    priceSource: "manual",
    purchases: [],
    ...overrides,
  };
}

test("historical portfolio starts on the earliest purchase date", () => {
  const holdings = [
    holding({ purchases: [{ date: "2026-02-03", quantity: 1, price: 10 }] }),
    holding({ id: "holding-2", purchases: [{ date: "2026-01-15", quantity: 1, price: 20 }] }),
  ];

  assert.equal(getHistoricalPortfolioStartDate(holdings, "2026-02-10"), "2026-01-15");
});

test("historical snapshots step invested capital and carry the latest market close", () => {
  const holdings = [
    holding({
      purchases: [{ date: "2026-01-02", quantity: 2, price: 10 }],
      quantity: 2,
      avgBuyPrice: 10,
    }),
    holding({
      id: "holding-2",
      assetName: "US Example",
      ticker: "USX",
      geography: "US",
      currency: "USD",
      purchases: [{ date: "2026-01-03", quantity: 1, price: 5 }],
      quantity: 1,
      avgBuyPrice: 5,
    }),
  ];

  const snapshots = buildHistoricalPortfolioSnapshots(
    holdings,
    {
      "holding-1": [{ date: "2026-01-02", price: 11 }],
      "holding-2": [{ date: "2026-01-03", price: 6 }],
    },
    [],
    { startDate: "2026-01-02", endDate: "2026-01-04", fallbackInrToAedRate: 0.044 }
  );

  assert.equal(snapshots.length, 3);
  assert.equal(snapshots[0].totalInvestedAed, 20);
  assert.equal(snapshots[0].totalValueAed, 22);
  assert.equal(snapshots[0].holdingsCount, 1);
  assert.equal(snapshots[1].totalInvestedAed, 20 + 5 * 3.6725);
  assert.equal(snapshots[1].totalValueAed, 22 + 6 * 3.6725);
  assert.equal(snapshots[1].holdingsCount, 2);
  assert.equal(snapshots[2].totalValueAed, snapshots[1].totalValueAed);
});

test("INR investment cost uses purchase FX while valuation uses daily historical FX", () => {
  const inrHolding = holding({
    currency: "INR",
    geography: "India",
    purchases: [{ date: "2026-01-02", quantity: 100, price: 10, fxRate: 0.04 }],
    quantity: 100,
    avgBuyPrice: 10,
  });

  const snapshots = buildHistoricalPortfolioSnapshots(
    [inrHolding],
    { "holding-1": [{ date: "2026-01-02", price: 11 }] },
    [
      { date: "2026-01-02", price: 0.041 },
      { date: "2026-01-03", price: 0.042 },
    ],
    { startDate: "2026-01-02", endDate: "2026-01-03", fallbackInrToAedRate: 0.044 }
  );

  assert.equal(snapshots[0].totalInvestedAed, 40);
  assert.equal(snapshots[0].totalValueAed, 45.1);
  assert.equal(snapshots[1].totalInvestedAed, 40);
  assert.equal(snapshots[1].totalValueAed, 46.2);
});
