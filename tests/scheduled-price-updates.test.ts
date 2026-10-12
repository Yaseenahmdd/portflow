import assert from "node:assert/strict";
import test from "node:test";
import type { Holding } from "../src/lib/constants.ts";
import {
  buildScheduledPriceUpdates,
  buildScheduledSnapshots,
  getScheduledSnapshotDate,
} from "../src/lib/prices/scheduled-updates.ts";

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
      priceAsOf: "2026-09-16T20:59:00.000Z",
      priceSession: "pre-market",
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
      priceAsOf: "2026-09-16T20:59:00.000Z",
      priceSession: "pre-market",
    },
  ]);
});

test("scheduled updates reject misaligned database rows", () => {
  assert.throws(
    () => buildScheduledPriceUpdates([createHolding()], [], []),
    /matching lengths/
  );
});

test("scheduled snapshots total each user's holdings in AED", () => {
  const snapshots = buildScheduledSnapshots(
    [
      createHolding({ quantity: 2, avgBuyPrice: 10, currentPrice: 15 }),
      createHolding({ id: "holding-2", currency: "INR", quantity: 10, avgBuyPrice: 100, currentPrice: 110 }),
      createHolding({ id: "holding-3", currency: "AED", quantity: 1, avgBuyPrice: 50, currentPrice: 40 }),
    ],
    ["user-a", "user-a", "user-b"],
    0.04,
    "2026-10-11"
  );

  assert.equal(snapshots.length, 2);
  const userA = snapshots.find((row) => row.user_id === "user-a");
  assert.equal(userA?.snapshot_date, "2026-10-11");
  assert.equal(userA?.holdings_count, 2);
  assert.ok(Math.abs((userA?.total_value_aed ?? 0) - (30 * 3.6725 + 1100 * 0.04)) < 1e-9);
  assert.ok(Math.abs((userA?.total_invested_aed ?? 0) - (20 * 3.6725 + 1000 * 0.04)) < 1e-9);
  assert.deepEqual(snapshots.find((row) => row.user_id === "user-b"), {
    user_id: "user-b",
    snapshot_date: "2026-10-11",
    total_value_aed: 40,
    total_invested_aed: 50,
    total_gain_loss_aed: -10,
    holdings_count: 1,
  });
});

test("the nightly run is dated to the Dubai day that just ended", () => {
  // 21:00 UTC is 01:00 the next day in Dubai, just after the US close.
  assert.equal(getScheduledSnapshotDate(new Date("2026-10-11T21:00:00.000Z")), "2026-10-11");
  assert.equal(getScheduledSnapshotDate(new Date("2026-10-11T21:59:00.000Z")), "2026-10-11");
  // A daytime run still belongs to the current Dubai day.
  assert.equal(getScheduledSnapshotDate(new Date("2026-10-12T08:00:00.000Z")), "2026-10-12");
});
