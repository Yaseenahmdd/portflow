import assert from "node:assert/strict";
import test from "node:test";
import type { Holding } from "../src/lib/constants.ts";
import { applyRefreshedPrices } from "../src/lib/dashboard/holdings-sync.ts";

function holding(overrides: Partial<Holding>): Holding {
  return {
    id: "h",
    platform: "IBKR",
    assetName: "Example",
    ticker: "EX",
    assetClass: "ETFs",
    sector: "",
    geography: "Global",
    risk: "Low",
    quantity: 1,
    avgBuyPrice: 100,
    currentPrice: 100,
    currency: "USD",
    notes: "",
    priceSource: "alphavantage",
    lastPriceUpdate: "2026-11-02T09:00:00.000Z",
    ...overrides,
  };
}

test("a price refresh keeps renames that landed while quotes were loading", () => {
  const snapshot = [holding({ id: "a", assetName: "Long Fund Name" }), holding({ id: "b", assetName: "Other" })];
  const current = [holding({ id: "a", assetName: "Short Name" }), holding({ id: "b", assetName: "Other" })];
  const refreshed = [
    {
      ...snapshot[0],
      currentPrice: 105,
      previousClose: 100,
      dayChangePercent: 5,
      priceAsOf: "2026-11-02T09:01:00.000Z",
      lastPriceUpdate: "2026-11-02T09:02:00.000Z",
    },
    snapshot[1],
  ];

  const [first, second] = applyRefreshedPrices(current, refreshed);

  assert.equal(first.assetName, "Short Name");
  assert.equal(first.currentPrice, 105);
  assert.equal(first.previousClose, 100);
  assert.equal(first.dayChangePercent, 5);
  assert.equal(first.lastPriceUpdate, "2026-11-02T09:02:00.000Z");
  assert.equal(second, current[1]);
});

test("a price refresh keeps holdings added or removed while quotes were loading", () => {
  const current = [holding({ id: "kept" }), holding({ id: "added", quantity: 3 })];
  const refreshed = [
    holding({ id: "kept", currentPrice: 101, lastPriceUpdate: "2026-11-02T09:05:00.000Z" }),
    holding({ id: "deleted", currentPrice: 50, lastPriceUpdate: "2026-11-02T09:05:00.000Z" }),
  ];

  const result = applyRefreshedPrices(current, refreshed);

  assert.deepEqual(result.map((item) => item.id), ["kept", "added"]);
  assert.equal(result[0].currentPrice, 101);
  assert.equal(result[1].quantity, 3);
});

test("a price refresh never replaces a newer quote synced from another device", () => {
  const current = [holding({ currentPrice: 110, lastPriceUpdate: "2026-11-02T09:10:00.000Z" })];
  const refreshed = [holding({ currentPrice: 105, lastPriceUpdate: "2026-11-02T09:05:00.000Z" })];

  assert.equal(applyRefreshedPrices(current, refreshed)[0].currentPrice, 110);
});
