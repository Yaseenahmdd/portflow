import assert from "node:assert/strict";
import test from "node:test";
import type { Holding } from "../src/lib/constants.ts";
import { buildScheduledPriceUpdates } from "../src/lib/prices/scheduled-updates.ts";

function createHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: "holding-1",
    platform: "Custom",
    assetName: "Test holding",
    ticker: "TEST",
    assetClass: "Stocks",
    sector: "",
    geography: "US",
    risk: "Medium",
    quantity: 1,
    avgBuyPrice: 10,
    currentPrice: 10,
    currency: "USD",
    notes: "",
    priceSource: "alphavantage",
    lastPriceUpdate: "2026-09-15T21:00:00.000Z",
    ...overrides,
  };
}

test("scheduled updates include only holdings that received a fresh price", () => {
  const original = [
    createHolding(),
    createHolding({ id: "holding-2", ticker: "MANUAL", priceSource: "manual" }),
  ];
  const refreshed = [
    createHolding({
      currentPrice: 12,
      previousClose: 11,
      dayChangePercent: 9.09,
      lastPriceUpdate: "2026-09-16T21:00:00.000Z",
    }),
    original[1],
  ];

  const updates = buildScheduledPriceUpdates(original, refreshed, [
    { userId: "user-1", id: "holding-1" },
    { userId: "user-1", id: "holding-2" },
  ]);

  assert.deepEqual(updates, [
    {
      userId: "user-1",
      id: "holding-1",
      currentPrice: 12,
      previousClose: 11,
      dayChangePercent: 9.09,
      lastPriceUpdate: "2026-09-16T21:00:00.000Z",
    },
  ]);
});

test("scheduled updates reject misaligned database rows", () => {
  assert.throws(
    () => buildScheduledPriceUpdates([createHolding()], [], []),
    /matching lengths/
  );
});
