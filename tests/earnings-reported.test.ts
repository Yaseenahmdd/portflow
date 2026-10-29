import assert from "node:assert/strict";
import test from "node:test";
import type { EarningsResult } from "../src/lib/api/nasdaq-earnings.ts";
import type { ComputedHolding } from "../src/lib/constants.ts";
import { getReportedTimeline, summarizeReported, type EarningsRow } from "../src/lib/earnings.ts";
import { getPriceReaction } from "../src/lib/earnings-reactions.ts";

const closes = [
  { date: "2026-10-16", price: 100 },
  { date: "2026-10-19", price: 102 },
  { date: "2026-10-20", price: 104 }, // report day (after close)
  { date: "2026-10-21", price: 93.6 },
  { date: "2026-10-22", price: 95 },
];

test("getPriceReaction spans the last close before to the first close after the report", () => {
  assert.deepEqual(getPriceReaction(closes, "2026-10-20"), {
    beforeDate: "2026-10-19",
    afterDate: "2026-10-21",
    changePercent: ((93.6 - 102) / 102) * 100,
  });
  // A weekend report uses Friday's and Monday's closes.
  assert.equal(getPriceReaction(closes, "2026-10-17")?.beforeDate, "2026-10-16");
  assert.equal(getPriceReaction(closes, "2026-10-17")?.afterDate, "2026-10-19");
  // No close after the report yet.
  assert.equal(getPriceReaction(closes, "2026-10-22"), null);
  assert.equal(getPriceReaction([], "2026-10-20"), null);
});

function row(symbol: string, valueAed: number, history: EarningsResult[]): EarningsRow {
  return {
    symbol,
    holdings: [{ assetName: symbol } as ComputedHolding],
    valueAed,
    weightPercent: 0,
    summary: { symbol, upcoming: null, history },
  };
}

test("getReportedTimeline merges stocks newest first within the window", () => {
  const rows = [
    row("META", 300, [
      { fiscalQuarter: "Sep 2026", reportedDate: "2026-10-21", eps: 7.4, consensusEps: 6.52, surprisePercent: 13.5, priceReaction: { beforeDate: "2026-10-21", afterDate: "2026-10-22", changePercent: -4 } },
      { fiscalQuarter: "Sep 2025", reportedDate: "2025-10-20", eps: 1, consensusEps: 1, surprisePercent: 0 },
    ]),
    row("PYPL", 100, [
      { fiscalQuarter: "Sep 2026", reportedDate: "2026-10-27", eps: 1.45, consensusEps: 1.31, surprisePercent: 10.69, priceReaction: { beforeDate: "2026-10-26", afterDate: "2026-10-28", changePercent: 7.5 } },
      { fiscalQuarter: "Jun 2026", reportedDate: "2026-07-28", eps: 1.38, consensusEps: 1.28, surprisePercent: -7.81, priceReaction: null },
    ]),
  ];

  const items = getReportedTimeline(rows, "2026-10-29");
  assert.deepEqual(items.map((item) => item.key), ["PYPL-2026-10-27", "META-2026-10-21", "PYPL-2026-07-28"]);

  const summary = summarizeReported(items);
  assert.equal(summary.beats, 2);
  assert.equal(summary.misses, 1);
  assert.equal(summary.medianSurprise, 10.69);
  assert.equal(summary.biggestMove?.key, "PYPL-2026-10-27");
});
