import assert from "node:assert/strict";
import test from "node:test";
import type { Holding } from "../src/lib/constants.ts";
import type { PortfolioTransaction } from "../src/lib/transactions.ts";
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
  assert.equal(snapshots[0].totalValueAed, 20);
  assert.equal(snapshots[0].holdingsCount, 1);
  assert.equal(snapshots[1].totalInvestedAed, 20 + 5 * 3.6725);
  assert.equal(snapshots[1].totalValueAed, 22 + 5 * 3.6725);
  assert.equal(snapshots[1].holdingsCount, 2);
  assert.equal(snapshots[2].totalValueAed, 22 + 6 * 3.6725);
});

test("purchase price anchors performance on the transaction date", () => {
  const purchasedHolding = holding({
    purchases: [{ date: "2026-01-02", quantity: 2, price: 10 }],
    quantity: 2,
    avgBuyPrice: 10,
  });

  const snapshots = buildHistoricalPortfolioSnapshots(
    [purchasedHolding],
    {
      "holding-1": [
        { date: "2026-01-02", price: 13 },
        { date: "2026-01-03", price: 14 },
      ],
    },
    [],
    { startDate: "2026-01-02", endDate: "2026-01-03", fallbackInrToAedRate: 0.044 }
  );

  assert.equal(snapshots[0].totalInvestedAed, 20);
  assert.equal(snapshots[0].totalValueAed, 20);
  assert.equal(snapshots[0].totalGainLossAed, 0);
  assert.equal(snapshots[1].totalValueAed, 28);
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
  assert.equal(snapshots[0].totalValueAed, 41);
  assert.equal(snapshots[1].totalInvestedAed, 40);
  assert.equal(snapshots[1].totalValueAed, 46.2);
});

test("historical snapshots replay Activity buys, sells, and splits", () => {
  const activityHolding = holding({
    quantity: 12,
    avgBuyPrice: 5,
    currentPrice: 11,
    purchases: [{ date: "2025-01-01", quantity: 99, price: 1 }],
  });
  const baseTransaction = {
    platform: "Custom",
    assetName: "Example",
    ticker: "EXAMPLE",
    currency: "AED" as const,
    notes: "",
    holdingId: activityHolding.id,
  };
  const transactions: PortfolioTransaction[] = [
    {
      ...baseTransaction,
      id: "buy-1",
      type: "buy",
      date: "2026-01-02",
      quantity: 10,
      price: 10,
    },
    {
      ...baseTransaction,
      id: "sell-1",
      type: "sell",
      date: "2026-01-03",
      quantity: 4,
      price: 20,
    },
    {
      ...baseTransaction,
      id: "split-1",
      type: "split",
      date: "2026-01-04",
      splitRatio: 2,
    },
  ];

  assert.equal(
    getHistoricalPortfolioStartDate([activityHolding], "2026-01-04", transactions),
    "2026-01-02"
  );

  const snapshots = buildHistoricalPortfolioSnapshots(
    [activityHolding],
    {
      "holding-1": [
        { date: "2026-01-02", price: 10 },
        { date: "2026-01-03", price: 20 },
        { date: "2026-01-04", price: 11 },
      ],
    },
    [],
    { startDate: "2026-01-02", endDate: "2026-01-04", fallbackInrToAedRate: 0.044 },
    transactions
  );

  assert.deepEqual(
    snapshots.map((snapshot) => ({
      date: snapshot.snapshotDate,
      invested: snapshot.totalInvestedAed,
      value: snapshot.totalValueAed,
    })),
    [
      { date: "2026-01-02", invested: 100, value: 100 },
      { date: "2026-01-03", invested: 60, value: 120 },
      { date: "2026-01-04", invested: 60, value: 132 },
    ]
  );
});
