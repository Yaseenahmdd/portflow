import assert from "node:assert/strict";
import test from "node:test";
import {
  filterSnapshotsByRange,
  getHistorySummary,
  getMaxDrawdown,
  type HistoryRange,
} from "../src/lib/portfolio-analytics.ts";
import type { PortfolioSnapshot } from "../src/lib/portfolio-snapshots.ts";

function snapshot(snapshotDate: string, totalValueAed: number, totalInvestedAed = 1000): PortfolioSnapshot {
  return {
    snapshotDate,
    totalValueAed,
    totalInvestedAed,
    totalGainLossAed: totalValueAed - totalInvestedAed,
    holdingsCount: 2,
  };
}

test("filterSnapshotsByRange keeps only snapshots inside the selected window", () => {
  const snapshots = [
    snapshot("2026-01-01", 900),
    snapshot("2026-04-01", 1000),
    snapshot("2026-04-20", 1100),
    snapshot("2026-05-01", 1200),
  ];

  const filtered = filterSnapshotsByRange(snapshots, "1M" satisfies HistoryRange);

  assert.deepEqual(filtered.map((item) => item.snapshotDate), ["2026-04-01", "2026-04-20", "2026-05-01"]);
});

test("getMaxDrawdown returns the largest peak-to-trough decline", () => {
  const drawdown = getMaxDrawdown([
    snapshot("2026-01-01", 1000),
    snapshot("2026-01-02", 1200),
    snapshot("2026-01-03", 900),
    snapshot("2026-01-04", 1100),
  ]);

  assert.equal(drawdown, -25);
});

test("getHistorySummary reports range return, contributions, and daily moves", () => {
  const summary = getHistorySummary([
    snapshot("2026-01-01", 1000, 900),
    snapshot("2026-01-02", 1100, 950),
    snapshot("2026-01-03", 990, 1000),
    snapshot("2026-01-04", 1200, 1100),
  ]);

  assert.equal(summary.rangeChangeAed, 200);
  assert.equal(summary.rangeReturnPercent, 20);
  assert.equal(summary.investedChangeAed, 200);
  assert.equal(summary.bestDailyMove?.snapshotDate, "2026-01-04");
  assert.equal(summary.worstDailyMove?.snapshotDate, "2026-01-03");
});
