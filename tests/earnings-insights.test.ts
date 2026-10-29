import assert from "node:assert/strict";
import test from "node:test";
import { parseForecastRows, parseRevenueTable, type EarningsDetails, type EarningsSummary } from "../src/lib/api/nasdaq-earnings.ts";
import { parseHeadlinesRss } from "../src/lib/api/yahoo-news.ts";
import { buildEarningsInsights, getRevenueGrowth } from "../src/lib/earnings-insights.ts";

// Shape and quarter-label quirks copied from Nasdaq's UBER revenue table.
const UBER_REVENUE_ROWS = [
  { value1: "March", value2: "", value3: "", value4: "" },
  { value1: "Revenue", value2: "$13,203(m)", value3: "$11,533(m)", value4: "$10,131(m)" },
  { value1: "EPS", value2: "$0.13 (03/31/2026)", value3: "$0.83 (03/31/2025)", value4: "($0.32) (03/31/2024)" },
  { value1: "Dividends", value2: "N/A", value3: "N/A", value4: "N/A" },
  { value1: "June", value2: "", value3: "", value4: "" },
  { value1: "Revenue", value2: "$14,191(m)", value3: "$12,651(m)", value4: "$10,700(m)" },
  { value1: "EPS", value2: "$1.16 (06/30/2026)", value3: "$0.63 (06/30/2025)", value4: "$0.47 (06/30/2024)" },
  { value1: "Dividends", value2: "N/A", value3: "N/A", value4: "N/A" },
  { value1: "December (FYE)", value2: "", value3: "", value4: "" },
  { value1: "Revenue", value2: "", value3: "$13,467(m)", value4: "$11,188(m)" },
  { value1: "EPS", value2: "", value3: "$3.11 (09/30/2025)", value4: "$1.21 (09/30/2024)" },
  { value1: "Totals", value2: "", value3: "", value4: "" },
  { value1: "Revenue", value2: "$27,394(m)", value3: "$52,017(m)", value4: "$43,978(m)" },
  { value1: "EPS", value2: "$1.29", value3: "$4.73", value4: "$4.56" },
];

test("parseRevenueTable dates quarters from the EPS cell and skips totals", () => {
  const quarters = parseRevenueTable(UBER_REVENUE_ROWS);

  assert.equal(quarters.length, 8);
  assert.deepEqual(quarters[0], { periodEnd: "2026-06-30", revenueMillions: 14191, eps: 1.16 });
  assert.deepEqual(quarters.find((quarter) => quarter.periodEnd === "2025-09-30"), {
    periodEnd: "2025-09-30",
    revenueMillions: 13467,
    eps: 3.11,
  });
  assert.equal(quarters.find((quarter) => quarter.periodEnd === "2024-03-31")?.eps, -0.32);
  assert.deepEqual(parseRevenueTable(undefined), []);
});

test("getRevenueGrowth compares with the same quarter a year earlier", () => {
  const quarters = parseRevenueTable(UBER_REVENUE_ROWS);
  assert.equal(getRevenueGrowth(quarters, "2026-06-30")?.toFixed(1), "12.2");
  assert.equal(getRevenueGrowth(quarters, "2024-06-30"), null);
});

test("parseForecastRows reads numbers and revision counts", () => {
  assert.deepEqual(
    parseForecastRows([{ fiscalEnd: "Sep 2026", consensusEPSForecast: 0.94, highEPSForecast: 1.09, lowEPSForecast: 0.84, noOfEstimates: 7, up: 0, down: 1 }]),
    [{ fiscalPeriod: "Sep 2026", consensus: 0.94, high: 1.09, low: 0.84, analysts: 7, revisionsUp: 0, revisionsDown: 1 }]
  );
});

test("parseHeadlinesRss decodes entities and ignores non-https links", () => {
  const xml = `<rss><channel>
    <item><title>Alibaba &amp; JD shares slide</title><link>https://finance.yahoo.com/a.html?.tsrc=rss</link><pubDate>Thu, 22 Oct 2026 06:00:06 +0000</pubDate></item>
    <item><title>Bad link</title><link>javascript:alert(1)</link></item>
  </channel></rss>`;

  assert.deepEqual(parseHeadlinesRss(xml), [
    { title: "Alibaba & JD shares slide", url: "https://finance.yahoo.com/a.html?.tsrc=rss", publishedAt: "2026-10-22T06:00:06.000Z" },
  ]);
});

const uberSummary: EarningsSummary = {
  symbol: "UBER",
  upcoming: { date: "2026-11-04", status: "confirmed", timing: "pre-market", fiscalQuarter: "Sep 2026", consensusEps: 0.94, lastYearEps: 3.11 },
  history: [
    { fiscalQuarter: "Jun 2026", reportedDate: "2026-08-05", eps: 1.17, consensusEps: 0.83, surprisePercent: 41 },
    { fiscalQuarter: "Mar 2026", reportedDate: "2026-05-06", eps: 0.13, consensusEps: 0.1, surprisePercent: 30 },
    { fiscalQuarter: "Dec 2025", reportedDate: "2026-02-04", eps: 0.16, consensusEps: 0.5, surprisePercent: -68 },
    { fiscalQuarter: "Sep 2025", reportedDate: "2025-11-04", eps: 3.11, consensusEps: 0.7, surprisePercent: 344 },
  ],
};

const uberDetails: EarningsDetails = {
  symbol: "UBER",
  quarterlyEstimates: [{ fiscalPeriod: "Sep 2026", consensus: 0.94, high: 1.09, low: 0.84, analysts: 7, revisionsUp: 0, revisionsDown: 1 }],
  yearlyEstimates: [{ fiscalPeriod: "Dec 2026", consensus: 3.2, high: 3.52, low: 2.43, analysts: 11, revisionsUp: 0, revisionsDown: 2 }],
  momentum: { quarterNow: 0.94, quarterMonthAgo: 0.94, yearNow: 3.2, yearMonthAgo: 3.21 },
  reported: parseRevenueTable(UBER_REVENUE_ROWS),
  analysts: { buy: 27, hold: 2, sell: 0, targetMean: 103, targetLow: 72, targetHigh: 125 },
};

test("buildEarningsInsights turns the numbers into a checklist", () => {
  const texts = buildEarningsInsights(uberSummary, uberDetails, 69.89).map((insight) => `${insight.tone}: ${insight.text}`);

  assert.deepEqual(texts, [
    "watch: The bar is low: consensus $0.94 is 70% below the $3.11 reported a year ago. Check whether last year included one-off gains.",
    "negative: Estimates are being cut: 1 down, 0 up in the last 4 weeks.",
    "watch: Mixed record: beat estimates in 3 of the last 4 quarters.",
    "watch: Revenue grew +12% year over year last quarter. Watch whether that pace holds.",
    "negative: Full-year (Dec 2026) estimates were cut 2 times in 4 weeks. Listen for whether guidance holds.",
    "positive: Average price target $103.00 is 47% above today's $69.89 (27 buy, 2 hold, 0 sell).",
  ]);
});

test("buildEarningsInsights flags thin coverage and loss swings", () => {
  const texts = buildEarningsInsights(
    { symbol: "LI", upcoming: { date: "2026-11-25", status: "estimated", consensusEps: -0.08, lastYearEps: 0.12 }, history: [] },
    { ...uberDetails, quarterlyEstimates: [{ fiscalPeriod: "Sep 2026", consensus: -0.08, high: -0.08, low: -0.08, analysts: 1, revisionsUp: 0, revisionsDown: 0 }], yearlyEstimates: [], reported: [], analysts: null, momentum: null },
    null
  ).map((insight) => insight.text);

  assert.deepEqual(texts, [
    "Analysts expect a swing to a loss: -$0.08 vs $0.12 a year ago.",
    "Only 1 analyst covers this quarter, so the consensus is thin.",
  ]);
});

test("buildEarningsInsights calls out an all-miss record with gaps", () => {
  const summary: EarningsSummary = {
    symbol: "LI",
    upcoming: null,
    history: [
      { fiscalQuarter: "Jun 2026", reportedDate: "2026-08-28", eps: -0.25, consensusEps: -0.01, surprisePercent: -2400 },
      { fiscalQuarter: "Mar 2026", reportedDate: "2026-05-29", eps: -0.33, consensusEps: 0, surprisePercent: null },
      { fiscalQuarter: "Dec 2025", reportedDate: "2026-03-13", eps: 0, consensusEps: 0.05, surprisePercent: -100 },
    ],
  };
  assert.deepEqual(
    buildEarningsInsights(summary, null, null).map((insight) => insight.text),
    ["Missed estimates in all of the last 2 reported quarters."]
  );
});

