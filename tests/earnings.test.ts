import assert from "node:assert/strict";
import test from "node:test";
import {
  parseEarningsDateText,
  parseEarningsSurpriseRows,
  projectNextEarnings,
} from "../src/lib/api/nasdaq-earnings.ts";
import type { ComputedHolding } from "../src/lib/constants.ts";
import { getEarningsCoverage, getEarningsSymbol, getSurpriseStreak } from "../src/lib/earnings.ts";

test("parseEarningsDateText reads a confirmed pre-market date", () => {
  const text =
    "Uber Technologies, Inc. Common Stock is expected* to report earnings on  11/04/2026 before market open.  The report will be for the fiscal Quarter ending Sep 2026.  According to Zacks Investment Research, based on  7 analysts'  forecasts, the consensus EPS forecast for the quarter is $0.94.  The reported EPS for the same quarter last year was $3.11.";

  assert.deepEqual(parseEarningsDateText(text), {
    date: "2026-11-04",
    status: "confirmed",
    timing: "pre-market",
    fiscalQuarter: "Sep 2026",
    consensusEps: 0.94,
    lastYearEps: 3.11,
  });
});

test("parseEarningsDateText reads an algorithmic estimate with negative EPS", () => {
  const text =
    "Li Auto Inc. American Depositary Shares is estimated to report earnings on  11/25/2026. The upcoming earnings date is derived from an algorithm based on a company's historical reporting dates. According to Zacks Investment Research, based on  1 analysts' forecasts, the consensus EPS forecast for the quarter is $-0.08.  The reported EPS for the same quarter last year was $0.12.";

  const result = parseEarningsDateText(text);
  assert.equal(result?.date, "2026-11-25");
  assert.equal(result?.status, "estimated");
  assert.equal(result?.timing, undefined);
  assert.equal(result?.consensusEps, -0.08);
  assert.equal(result?.lastYearEps, 0.12);
});

test("parseEarningsDateText returns null when no date is published", () => {
  assert.equal(
    parseEarningsDateText("Our vendor, Zacks Investment Research, hasn't provided us with the upcoming earnings report date."),
    null
  );
});

test("parseEarningsSurpriseRows sorts newest first and parses strings", () => {
  const rows = parseEarningsSurpriseRows([
    { fiscalQtrEnd: "Jun 2026", dateReported: "7/28/2026", eps: 1.38, consensusForecast: "1.28", percentageSurprise: "7.81" },
    { fiscalQtrEnd: "Sep 2026", dateReported: "10/27/2026", eps: 1.45, consensusForecast: "1.31", percentageSurprise: "10.69" },
    { fiscalQtrEnd: "Bad", dateReported: "" },
  ]);

  assert.deepEqual(rows, [
    { fiscalQuarter: "Sep 2026", reportedDate: "2026-10-27", eps: 1.45, consensusEps: 1.31, surprisePercent: 10.69 },
    { fiscalQuarter: "Jun 2026", reportedDate: "2026-07-28", eps: 1.38, consensusEps: 1.28, surprisePercent: 7.81 },
  ]);
});

test("projectNextEarnings rolls forward a quarter past today", () => {
  const history = parseEarningsSurpriseRows([{ fiscalQtrEnd: "Sep 2026", dateReported: "10/21/2026", eps: 7.4 }]);
  assert.deepEqual(projectNextEarnings(history, "2026-10-29"), { date: "2027-01-20", status: "projected" });
  assert.deepEqual(projectNextEarnings(history, "2027-02-01"), { date: "2027-04-21", status: "projected" });
  // 2026-10-17 + 91 days lands on Saturday 2027-01-16.
  const saturday = parseEarningsSurpriseRows([{ fiscalQtrEnd: "Sep 2026", dateReported: "10/17/2026", eps: 0.49 }]);
  assert.deepEqual(projectNextEarnings(saturday, "2026-10-29"), { date: "2027-01-15", status: "projected" });
  assert.equal(projectNextEarnings([], "2026-10-29"), null);
});

function holding(overrides: Partial<ComputedHolding>): ComputedHolding {
  return {
    id: overrides.ticker ?? "x",
    platform: "IBKR",
    assetName: overrides.ticker ?? "x",
    ticker: "META",
    assetClass: "Stocks",
    sector: "",
    geography: "US",
    risk: "Medium",
    quantity: 1,
    avgBuyPrice: 1,
    currentPrice: 1,
    currency: "USD",
    notes: "",
    priceSource: "alphavantage",
    currentValueAed: 100,
    ...overrides,
  } as ComputedHolding;
}

test("getEarningsSymbol maps US listings and Hong Kong aliases", () => {
  assert.equal(getEarningsSymbol(holding({ ticker: "meta" })), "META");
  assert.equal(getEarningsSymbol(holding({ ticker: "BRK.B" })), "BRK.B");
  assert.equal(getEarningsSymbol(holding({ ticker: "9618.HK", geography: "Others" })), "JD");
  assert.equal(getEarningsSymbol(holding({ ticker: "0700.HK", geography: "Others" })), null);
  assert.equal(getEarningsSymbol(holding({ ticker: "HDFCAMC", geography: "India" })), null);
  assert.equal(getEarningsSymbol(holding({ ticker: "SALIK", geography: "UAE", priceSource: "dfm" })), null);
  assert.equal(getEarningsSymbol(holding({ ticker: "IBIT", assetClass: "ETFs" })), undefined);
});

test("getEarningsCoverage merges listings of the same company", () => {
  const coverage = getEarningsCoverage(
    [
      holding({ ticker: "BABA", currentValueAed: 300 }),
      holding({ ticker: "9988.HK", geography: "Others", currentValueAed: 100 }),
      holding({ ticker: "0700.HK", geography: "Others", currentValueAed: 400 }),
      holding({ ticker: "GLD", assetClass: "ETFs", currentValueAed: 200 }),
      holding({ ticker: "META", quantity: 0 }),
    ],
    1000
  );

  assert.equal(coverage.positions.length, 1);
  assert.equal(coverage.positions[0].symbol, "BABA");
  assert.equal(coverage.positions[0].valueAed, 400);
  assert.equal(coverage.positions[0].weightPercent, 40);
  assert.deepEqual(coverage.uncovered.map((item) => item.ticker), ["0700.HK"]);
});

test("getSurpriseStreak counts consecutive beats or misses from the latest report", () => {
  const summary = (surprises: Array<number | null>) => ({
    symbol: "X",
    upcoming: null,
    history: surprises.map((surprisePercent, index) => ({
      fiscalQuarter: String(index),
      reportedDate: `2026-0${9 - index}-01`,
      eps: 1,
      consensusEps: 1,
      surprisePercent,
    })),
  });

  assert.equal(getSurpriseStreak(summary([10, 7, 5, -4])), 3);
  assert.equal(getSurpriseStreak(summary([-12, 8])), -1);
  assert.equal(getSurpriseStreak(summary([null, 5])), 0);
  assert.equal(getSurpriseStreak(null), 0);
});
