import assert from "node:assert/strict";
import test from "node:test";
import {
  filterSnapshotsByRange,
  getBestAndWorstMarketMoves,
  getContributionAdjustedPerformance,
  getHistorySummary,
  getMaxDrawdown,
  getOvernightTotalReturnChange,
  getPortfolioActivity,
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

test("filterSnapshotsByRange clamps month-end and leap-year boundaries", () => {
  const monthEnd = [
    snapshot("2026-02-28", 1000),
    snapshot("2026-03-03", 1000),
    snapshot("2026-03-31", 1000),
  ];
  const quarterEnd = [
    snapshot("2026-02-28", 1000),
    snapshot("2026-03-03", 1000),
    snapshot("2026-05-31", 1000),
  ];
  const leapYear = [
    snapshot("2023-02-28", 1000),
    snapshot("2023-03-01", 1000),
    snapshot("2024-02-29", 1000),
  ];

  assert.deepEqual(
    filterSnapshotsByRange(monthEnd, "1M").map((item) => item.snapshotDate),
    ["2026-02-28", "2026-03-03", "2026-03-31"]
  );
  assert.deepEqual(
    filterSnapshotsByRange(quarterEnd, "3M").map((item) => item.snapshotDate),
    ["2026-02-28", "2026-03-03", "2026-05-31"]
  );
  assert.deepEqual(
    filterSnapshotsByRange(leapYear, "1Y").map((item) => item.snapshotDate),
    ["2023-02-28", "2023-03-01", "2024-02-29"]
  );
});

test("filterSnapshotsByRange includes the prior year close for YTD", () => {
  const filtered = filterSnapshotsByRange([
    snapshot("2025-12-30", 1000),
    snapshot("2025-12-31", 1000),
    snapshot("2026-01-01", 1100),
    snapshot("2026-09-07", 1100),
  ], "YTD");

  assert.deepEqual(filtered.map((item) => item.snapshotDate), [
    "2025-12-31",
    "2026-01-01",
    "2026-09-07",
  ]);
});

test("getContributionAdjustedPerformance reports growth when invested capital is unchanged", () => {
  const performance = getContributionAdjustedPerformance([
    snapshot("2026-01-01", 1000, 1000),
    snapshot("2026-01-02", 1100, 1000),
  ]);

  assert.equal(performance.adjustedChangeAed, 100);
  assert.ok(Math.abs((performance.returnPercent ?? 0) - 10) < 1e-9);
  assert.equal(performance.estimatedContributionsAed, 0);
});

test("getOvernightTotalReturnChange subtracts yesterday night's total return", () => {
  const performance = getOvernightTotalReturnChange(
    [
      snapshot("2026-09-19", 1050, 1000),
      snapshot("2026-09-20", 1080, 1000),
      snapshot("2026-09-21", 1100, 1000),
    ],
    100,
    new Date("2026-09-21T08:00:00.000Z")
  );

  assert.equal(performance.changeAed, 20);
  assert.ok(Math.abs((performance.changePercent ?? 0) - (20 / 1080) * 100) < 1e-9);
  assert.equal(performance.baselineDate, "2026-09-20");
});

test("getOvernightTotalReturnChange does not substitute an older snapshot for yesterday", () => {
  const performance = getOvernightTotalReturnChange(
    [snapshot("2026-09-19", 1050, 1000)],
    100,
    new Date("2026-09-21T08:00:00.000Z")
  );

  assert.equal(performance.changeAed, null);
  assert.equal(performance.changePercent, null);
  assert.equal(performance.baselineDate, "2026-09-20");
});

test("getContributionAdjustedPerformance excludes added capital and uses closing invested cost", () => {
  const performance = getContributionAdjustedPerformance([
    snapshot("2026-01-01", 1000, 1000),
    snapshot("2026-01-02", 1600, 1500),
  ]);

  assert.equal(performance.adjustedChangeAed, 100);
  assert.ok(Math.abs((performance.returnPercent ?? 0) - (100 / 1500) * 100) < 1e-9);
  assert.equal(performance.estimatedContributionsAed, 500);
});

test("getContributionAdjustedPerformance treats reduced invested capital as a withdrawal", () => {
  const performance = getContributionAdjustedPerformance([
    snapshot("2026-01-01", 1000, 1000),
    snapshot("2026-01-02", 800, 800),
  ]);

  assert.equal(performance.adjustedChangeAed, 0);
  assert.equal(performance.returnPercent, 0);
  assert.equal(performance.estimatedContributionsAed, -200);
});

test("getContributionAdjustedPerformance sorts snapshots and compares gain against closing cost", () => {
  const performance = getContributionAdjustedPerformance([
    snapshot("2026-01-03", 1800, 1500),
    snapshot("2026-01-01", 1000, 1000),
    snapshot("2026-01-02", 1100, 1000),
  ]);

  assert.equal(performance.adjustedChangeAed, 300);
  assert.ok(Math.abs((performance.returnPercent ?? 0) - 20) < 1e-9);
  assert.equal(performance.startDate, "2026-01-01");
  assert.equal(performance.endDate, "2026-01-03");
});

test("getContributionAdjustedPerformance includes the opening gain for all-time performance", () => {
  const performance = getContributionAdjustedPerformance([
    snapshot("2026-01-01", 1100, 1000),
    snapshot("2026-01-02", 1300, 1200),
  ], true);

  assert.equal(performance.adjustedChangeAed, 100);
  assert.ok(Math.abs((performance.returnPercent ?? 0) - (100 / 1200) * 100) < 1e-9);
});

test("getContributionAdjustedPerformance requires two snapshots and a positive start value", () => {
  const insufficient = getContributionAdjustedPerformance([
    snapshot("2026-01-01", 1000, 1000),
  ]);
  const zeroStart = getContributionAdjustedPerformance([
    snapshot("2026-01-01", 0, 0),
    snapshot("2026-01-02", 500, 500),
  ]);

  assert.equal(insufficient.adjustedChangeAed, null);
  assert.equal(insufficient.returnPercent, null);
  assert.equal(insufficient.snapshotCount, 1);
  assert.equal(zeroStart.adjustedChangeAed, null);
  assert.equal(zeroStart.returnPercent, null);
});

test("getPortfolioActivity separates deposits and withdrawals from market movement", () => {
  const activity = getPortfolioActivity([
    snapshot("2026-01-01", 1000, 1000),
    snapshot("2026-01-02", 1600, 1500),
    snapshot("2026-01-03", 1400, 1300),
  ]);

  assert.equal(activity[0].marketChangeAed, null);
  assert.equal(activity[1].investedChangeAed, 500);
  assert.equal(activity[1].marketChangeAed, 100);
  assert.ok(Math.abs((activity[1].marketReturnPercent ?? 0) - (100 / 1500) * 100) < 1e-9);
  assert.equal(activity[2].investedChangeAed, -200);
  assert.equal(activity[2].marketChangeAed, 0);
  assert.equal(activity[2].marketReturnPercent, 0);
});

test("getBestAndWorstMarketMoves ignores cash flows when ranking days", () => {
  const moves = getBestAndWorstMarketMoves(
    getPortfolioActivity([
      snapshot("2026-01-01", 1000, 1000),
      snapshot("2026-01-02", 1600, 1500),
      snapshot("2026-01-03", 1500, 1500),
    ])
  );

  assert.equal(moves.best?.snapshot.snapshotDate, "2026-01-02");
  assert.equal(moves.best?.marketChangeAed, 100);
  assert.equal(moves.worst?.snapshot.snapshotDate, "2026-01-03");
  assert.equal(moves.worst?.marketChangeAed, -100);
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

test("getHistorySummary reports contribution-adjusted return and daily moves", () => {
  const summary = getHistorySummary([
    snapshot("2026-01-01", 1000, 900),
    snapshot("2026-01-02", 1100, 950),
    snapshot("2026-01-03", 990, 1000),
    snapshot("2026-01-04", 1200, 1100),
  ]);

  assert.equal(summary.rangeChangeAed, 0);
  assert.equal(summary.rangeReturnPercent, 0);
  assert.equal(summary.investedChangeAed, 200);
  assert.equal(summary.bestDailyMove?.snapshotDate, "2026-01-04");
  assert.equal(summary.worstDailyMove?.snapshotDate, "2026-01-03");
});
