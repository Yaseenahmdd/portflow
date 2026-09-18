import assert from "node:assert/strict";
import test from "node:test";
import { getBenchmarkPerformance } from "../src/lib/benchmark-performance.ts";

test("benchmark performance uses the prior market close as the range baseline", () => {
  const performance = getBenchmarkPerformance(
    [
      { date: "2025-12-31", price: 100 },
      { date: "2026-01-02", price: 105 },
      { date: "2026-01-05", price: 110 },
    ],
    "2026-01-01",
    "2026-01-05"
  );

  assert.deepEqual(performance, {
    returnPercent: 10,
    startDate: "2025-12-31",
    endDate: "2026-01-05",
    startPrice: 100,
    endPrice: 110,
  });
});

test("benchmark performance falls back to the first available close in range", () => {
  const performance = getBenchmarkPerformance(
    [
      { date: "2026-01-02", price: 200 },
      { date: "2026-01-05", price: 190 },
    ],
    "2026-01-01",
    "2026-01-05"
  );

  assert.equal(performance?.returnPercent, -5);
  assert.equal(performance?.startDate, "2026-01-02");
});

test("benchmark performance rejects ranges without two valid closes", () => {
  assert.equal(
    getBenchmarkPerformance([{ date: "2026-01-02", price: 200 }], "2026-01-01", "2026-01-05"),
    null
  );
});
