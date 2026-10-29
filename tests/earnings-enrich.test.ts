import assert from "node:assert/strict";
import test from "node:test";
import { parseRevenueEstimates } from "../src/lib/api/alphavantage-estimates.ts";
import { parseFinnhubCalendar, parseFinnhubNews } from "../src/lib/api/finnhub.ts";
import type { EarningsSummary } from "../src/lib/api/nasdaq-earnings.ts";
import {
  applyFinnhubRevenue,
  applyGuidance,
  applyHistoricalRevenue,
  classifyOutlookHeadline,
  detectGuidance,
  detectOutlook,
  getCompanyTokens,
  getEstimateChange,
  getRevenueSurprise,
} from "../src/lib/earnings-enrich.ts";
import { mergeReportRows, type EarningsReportRow } from "../src/lib/earnings-store.ts";

test("parseFinnhubCalendar maps timing and drops undated rows", () => {
  assert.deepEqual(
    parseFinnhubCalendar([
      { date: "2026-10-21", hour: "amc", epsEstimate: 5.79, epsActual: 7.4, revenueEstimate: 64635778699, revenueActual: 64601000000 },
      { date: "2026-11-04", hour: "bmo", epsEstimate: 0.98, epsActual: null, revenueEstimate: 14999287027, revenueActual: null },
      { hour: "amc" },
    ]),
    [
      { date: "2026-11-04", timing: "pre-market", epsEstimate: 0.98, epsActual: null, revenueEstimate: 14999287027, revenueActual: null },
      { date: "2026-10-21", timing: "after-hours", epsEstimate: 5.79, epsActual: 7.4, revenueEstimate: 64635778699, revenueActual: 64601000000 },
    ]
  );
});

test("applyFinnhubRevenue matches reports within a few days and fills the upcoming estimate", () => {
  const summary: EarningsSummary = {
    symbol: "PYPL",
    upcoming: { date: "2027-02-02", status: "projected" },
    history: [
      { fiscalQuarter: "Sep 2026", reportedDate: "2026-10-27", eps: 1.45, consensusEps: 1.31, surprisePercent: 10.69 },
      { fiscalQuarter: "Jun 2026", reportedDate: "2026-07-28", eps: 1.38, consensusEps: 1.28, surprisePercent: 7.81 },
    ],
  };
  const result = applyFinnhubRevenue(summary, [
    { date: "2027-02-03", timing: "pre-market", epsEstimate: 1.5, epsActual: null, revenueEstimate: 9.1e9, revenueActual: null },
    { date: "2026-10-27", timing: "pre-market", epsEstimate: 1.34, epsActual: 1.45, revenueEstimate: 8887087620, revenueActual: 8584000000 },
  ]);

  assert.equal(result.history[0].revenueActual, 8584000000);
  assert.equal(result.history[0].revenueSurprisePercent?.toFixed(2), "-3.41");
  assert.equal(result.history[1].revenueEstimate, undefined);
  assert.equal(result.upcoming?.revenueEstimate, 9.1e9);
  assert.equal(result.upcoming?.timing, "pre-market");
  // A projected date is replaced by Finnhub's own date for the next report.
  assert.equal(result.upcoming?.date, "2027-02-03");
  assert.equal(result.upcoming?.status, "estimated");
  assert.equal(getRevenueSurprise(0, 5), null);
});

test("getCompanyTokens keeps short names distinctive", () => {
  assert.deepEqual(getCompanyTokens("LI", "Li Auto Inc."), ["LI", "Li Auto"]);
  assert.deepEqual(getCompanyTokens("JD", "JD.com, Inc."), ["JD", "JD.com"]);
  assert.deepEqual(getCompanyTokens("PYPL", "PayPal Holdings, Inc."), ["PYPL", "PayPal"]);
  assert.deepEqual(getCompanyTokens("UBER"), ["UBER"]);
});

const at = (date: string) => `${date}T14:00:00.000Z`;

test("detectGuidance reads raised, lowered and reaffirmed headlines about the company", () => {
  const tokens = getCompanyTokens("PYPL", "PayPal Holdings, Inc.");
  const headline = (title: string, date = "2026-10-27") => ({ title, url: `https://example.com/${title.length}`, publishedAt: at(date) });

  assert.equal(detectGuidance([headline("PayPal raises full-year profit forecast as Venmo grows")], "2026-10-27", tokens)?.direction, "raised");
  assert.equal(detectGuidance([headline("PayPal shares sink on weak holiday-quarter outlook")], "2026-10-27", tokens)?.direction, "lowered");
  assert.equal(detectGuidance([headline("PayPal reaffirms 2026 guidance after mixed quarter")], "2026-10-27", tokens)?.direction, "reaffirmed");
  assert.equal(detectGuidance([headline("PYPL cuts annual outlook")], "2026-10-27", tokens)?.direction, "lowered");

  // Another company's guidance, an analyst price target, or a headline outside the window is ignored.
  assert.equal(detectGuidance([headline("Alibaba raises guidance")], "2026-10-27", tokens), null);
  assert.equal(detectGuidance([headline("Analyst raises PayPal price target to $90")], "2026-10-27", tokens), null);
  assert.equal(detectGuidance([headline("PayPal raises outlook", "2026-10-10")], "2026-10-27", tokens), null);
});

test("detectGuidance resolves conflicts by majority, then the newest headline", () => {
  const tokens = ["META", "Meta"];
  const headlines = [
    { title: "Meta lifts revenue outlook on AI ads", url: "https://example.com/1", publishedAt: at("2026-10-23") },
    { title: "Meta's capex forecast disappoints investors", url: "https://example.com/2", publishedAt: at("2026-10-22") },
    { title: "Meta boosts full-year guidance", url: "https://example.com/3", publishedAt: at("2026-10-21") },
  ];
  assert.deepEqual(detectGuidance(headlines, "2026-10-21", tokens), {
    direction: "raised",
    headline: "Meta lifts revenue outlook on AI ads",
    url: "https://example.com/1",
  });
});

test("getEstimateChange compares the consensus before and after the report", () => {
  const points = [
    { asOfDate: "2026-10-19", consensus: 26.0 },
    { asOfDate: "2026-10-20", consensus: 26.2 },
    { asOfDate: "2026-10-22", consensus: 27.25 },
    { asOfDate: "2026-10-24", consensus: 27.51 },
  ];
  assert.equal(getEstimateChange(points, "2026-10-21")?.toFixed(1), "5.0");
  assert.equal(getEstimateChange(points.slice(0, 2), "2026-10-21"), null);
  assert.equal(getEstimateChange([], "2026-10-21"), null);
});

test("mergeReportRows keeps stored revenue and guidance the source no longer returns", () => {
  const base: EarningsReportRow = {
    symbol: "META",
    fiscal_quarter: "Sep 2026",
    reported_date: "2026-10-21",
    eps: 7.4,
    consensus_eps: 6.52,
    surprise_percent: 13.5,
    reaction_before_date: null,
    reaction_after_date: null,
    reaction_change_percent: null,
    revenue_estimate: null,
    revenue_actual: null,
    revenue_surprise_percent: null,
    guidance: null,
    guidance_headline: null,
    guidance_url: null,
    estimate_change_percent: null,
  };
  const stored = {
    ...base,
    revenue_estimate: 64635778699,
    revenue_actual: 64601000000,
    revenue_surprise_percent: -0.05,
    guidance: "raised",
    guidance_headline: "Meta lifts outlook",
    guidance_url: "https://example.com/1",
    reaction_change_percent: -6.5,
  };
  const [merged] = mergeReportRows([{ ...base, reaction_change_percent: -6.4 }], [stored]);
  assert.equal(merged.revenue_actual, 64601000000);
  assert.equal(merged.guidance, "raised");
  assert.equal(merged.reaction_change_percent, -6.4);
});

test("classifyOutlookHeadline keeps spending plans apart from guidance", () => {
  assert.deepEqual(
    classifyOutlookHeadline("Meta Falls 3% as Higher AI Spending Outlook Overshadows Earnings Beat; Alphabet Dips"),
    { kind: "spending", direction: "raised" }
  );
  assert.deepEqual(classifyOutlookHeadline("Alphabet hikes capex forecast to $95 billion"), { kind: "spending", direction: "raised" });
  assert.deepEqual(classifyOutlookHeadline("Intel cuts capital spending plans for 2027"), { kind: "spending", direction: "lowered" });
  assert.deepEqual(
    classifyOutlookHeadline("Meta Reports Mixed Q2 Results, Raises Low End of CapEx Guidance Range, Shares Move Lower"),
    { kind: "spending", direction: "raised" }
  );
  assert.deepEqual(classifyOutlookHeadline("Meta forecasts higher revenue outlook for holiday quarter"), { kind: "guidance", direction: "raised" });
  assert.deepEqual(classifyOutlookHeadline("PayPal raises profit forecast amid cost cuts"), { kind: "guidance", direction: "raised" });
  // Mentions an outlook but says nothing about its direction.
  assert.equal(classifyOutlookHeadline("GE Vernova Slumps 11% as Meta's Spending Outlook Stokes AI Financing Worries"), null);
  assert.equal(classifyOutlookHeadline("Vistra Stock Fell Nearly 10% After Meta's Earnings. Here's Why Its Forecast Already Discounts the Hype"), null);
  assert.equal(classifyOutlookHeadline("Uber Analysts Slash Their Forecasts After Q4 Results"), null);
  assert.equal(classifyOutlookHeadline("Will Google Follow Meta With Much Higher 2026 Capital Spending Guidance?"), null);
});

test("detectOutlook reports guidance and spending separately and skips duplicates", () => {
  const tokens = getCompanyTokens("META", "Meta Platforms, Inc.");
  const headlines = [
    { title: "Meta Falls 3% as Higher AI Spending Outlook Overshadows Earnings Beat", url: "https://example.com/a", publishedAt: at("2026-10-22") },
    { title: "Meta Falls 3% as Higher AI Spending Outlook Overshadows Earnings Beat", url: "https://example.com/b", publishedAt: at("2026-10-22") },
    { title: "Meta lifts revenue outlook for the fourth quarter", url: "https://example.com/c", publishedAt: at("2026-10-21") },
  ];
  const outlook = detectOutlook(headlines, "2026-10-21", tokens);
  assert.equal(outlook.guidance?.direction, "raised");
  assert.equal(outlook.guidance?.url, "https://example.com/c");
  assert.equal(outlook.spending?.direction, "raised");
  assert.equal(outlook.spending?.url, "https://example.com/a");

  const summary = applyGuidance(
    { symbol: "META", upcoming: null, history: [{ fiscalQuarter: "Sep 2026", reportedDate: "2026-10-21", eps: 7.4, consensusEps: 6.52, surprisePercent: 13.5 }] },
    headlines.slice(0, 1),
    tokens
  );
  assert.equal(summary.history[0].guidance, undefined);
  assert.equal(summary.history[0].spendingOutlook?.direction, "raised");
});

test("detectOutlook ignores another company's outlook in a market wrap headline", () => {
  const tokens = getCompanyTokens("AMZN", "Amazon.com, Inc.");
  const wrap = (title: string) => [{ title, url: "https://example.com/w", publishedAt: at("2026-07-31") }];
  assert.equal(detectGuidance(wrap("Stock Market Today: Dow Rises But Apple Dives On Weak Forecast; Amazon Surges On Earnings"), "2026-07-30", tokens), null);
  assert.equal(detectGuidance(wrap("Amazon Beats Q1 Estimates, Issues Strong Guidance As AWS Growth Accelerates"), "2026-07-30", tokens)?.direction, "raised");
  assert.equal(detectGuidance(wrap("Amazon Third-Quarter Results Rise; Issues Strong Revenue Outlook"), "2026-07-30", tokens)?.direction, "raised");
  assert.equal(
    detectOutlook(wrap("Amazon Shares Surge on Cloud-Driven Quarterly Beat; CapEx Outlook Raised"), "2026-07-30", tokens).spending?.direction,
    "raised"
  );
});

test("parseFinnhubNews keeps dated https items, newest first", () => {
  assert.deepEqual(
    parseFinnhubNews([
      { datetime: 1792540800, headline: " Meta beats ", url: "https://finnhub.io/api/news?id=1" },
      { datetime: 1792627200, headline: "Meta lifts outlook", url: "https://finnhub.io/api/news?id=2" },
      { datetime: 1792627200, headline: "No link", url: "ftp://example.com" },
      { headline: "No date", url: "https://example.com" },
    ]),
    [
      { title: "Meta lifts outlook", url: "https://finnhub.io/api/news?id=2", publishedAt: "2026-10-22T00:00:00.000Z" },
      { title: "Meta beats", url: "https://finnhub.io/api/news?id=1", publishedAt: "2026-10-21T00:00:00.000Z" },
    ]
  );
});

test("parseRevenueEstimates keeps quarterly consensus rows, newest first", () => {
  assert.deepEqual(
    parseRevenueEstimates([
      { date: "2026-12-31", horizon: "fiscal year", revenue_estimate_average: "57884357170.00" },
      { date: "2026-03-31", horizon: "fiscal quarter", revenue_estimate_average: "13262658480.00" },
      { date: "2026-06-30", horizon: "fiscal quarter", revenue_estimate_average: "14261801290.00" },
      { date: "2026-09-30", horizon: "fiscal quarter", revenue_estimate_average: "" },
    ]),
    [
      { periodEnd: "2026-06-30", revenueEstimate: 14261801290 },
      { periodEnd: "2026-03-31", revenueEstimate: 13262658480 },
    ]
  );
});

test("applyHistoricalRevenue fills past revenue beat/miss from consensus and reported revenue", () => {
  const summary: EarningsSummary = {
    symbol: "UBER",
    upcoming: null,
    history: [
      { fiscalQuarter: "Sep 2026", reportedDate: "2026-11-04", eps: 1, consensusEps: 0.9, surprisePercent: 11, revenueEstimate: 1.5e10, revenueActual: 1.52e10, revenueSurprisePercent: 1.33 },
      { fiscalQuarter: "Jun 2026", reportedDate: "2026-08-05", eps: 1.17, consensusEps: 0.83, surprisePercent: 41 },
      { fiscalQuarter: "Mar 2026", reportedDate: "2026-05-06", eps: 0.72, consensusEps: 0.7, surprisePercent: 2.9 },
    ],
  };
  const result = applyHistoricalRevenue(
    summary,
    [
      { periodEnd: "2026-06-30", revenueEstimate: 14261801290 },
      { periodEnd: "2026-09-30", revenueEstimate: 1e10 },
    ],
    [
      { periodEnd: "2026-06-30", revenueMillions: 14191, eps: 1.16 },
      { periodEnd: "2026-03-31", revenueMillions: 13203, eps: 0.13 },
    ]
  );

  // Finnhub's own figure for the latest quarter is kept.
  assert.equal(result.history[0].revenueSurprisePercent, 1.33);
  assert.equal(result.history[1].revenueActual, 14191e6);
  assert.equal(result.history[1].revenueSurprisePercent?.toFixed(2), "-0.50");
  // No consensus for March, so it stays empty.
  assert.equal(result.history[2].revenueSurprisePercent, undefined);
});
