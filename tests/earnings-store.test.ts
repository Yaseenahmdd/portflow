import assert from "node:assert/strict";
import test from "node:test";
import type { EarningsDetails, EarningsSummary } from "../src/lib/api/nasdaq-earnings.ts";
import {
  fromStoredRows,
  isStoredEarningsStale,
  loadEarnings,
  mapWithConcurrency,
  mergeHistory,
  toEstimateRows,
  toReportRows,
  toSymbolRow,
  type StoredEarnings,
} from "../src/lib/earnings-store.ts";
import { getScheduledEarningsSymbols } from "../src/lib/earnings-scheduled-refresh.ts";
import type { HoldingRow } from "../src/lib/holdings-store.ts";

const summary: EarningsSummary = {
  symbol: "UBER",
  upcoming: { date: "2026-11-04", status: "confirmed", timing: "pre-market", fiscalQuarter: "Sep 2026", consensusEps: 0.94 },
  history: [
    {
      fiscalQuarter: "Jun 2026",
      reportedDate: "2026-08-05",
      eps: 1.17,
      consensusEps: 0.83,
      surprisePercent: 40.96,
      priceReaction: { beforeDate: "2026-08-04", afterDate: "2026-08-06", changePercent: -2.1 },
    },
    { fiscalQuarter: "Mar 2026", reportedDate: "2026-05-06", eps: 0.72, consensusEps: 0.7, surprisePercent: 2.86, priceReaction: null },
  ],
};

const details: EarningsDetails = {
  symbol: "UBER",
  quarterlyEstimates: [{ fiscalPeriod: "Sep 2026", consensus: 0.94, high: 1.09, low: 0.84, analysts: 7, revisionsUp: 0, revisionsDown: 1 }],
  yearlyEstimates: [{ fiscalPeriod: "Dec 2026", consensus: 3.2, high: 3.52, low: 2.43, analysts: 11, revisionsUp: 0, revisionsDown: 2 }],
  momentum: null,
  reported: [{ periodEnd: "2026-06-30", revenueMillions: 14191, eps: 1.16 }],
  analysts: { buy: 27, hold: 2, sell: 0, targetMean: 103, targetLow: 72, targetHigh: 125 },
};

const collected = { companyName: "Uber Technologies, Inc.", summary, details, headlines: [{ title: "Uber news", url: "https://example.com/a", publishedAt: null }], price: 65.27 };

test("stored rows round-trip back to the same earnings data", () => {
  const symbolRow = toSymbolRow(collected, "2026-10-29T23:00:00.000Z");
  assert.equal(symbolRow.symbol, "UBER");
  assert.equal("symbol" in symbolRow.details, false);

  const reportRows = toReportRows(summary);
  assert.deepEqual(reportRows[0], {
    symbol: "UBER",
    fiscal_quarter: "Jun 2026",
    reported_date: "2026-08-05",
    eps: 1.17,
    consensus_eps: 0.83,
    surprise_percent: 40.96,
    reaction_before_date: "2026-08-04",
    reaction_after_date: "2026-08-06",
    reaction_change_percent: -2.1,
    revenue_estimate: null,
    revenue_actual: null,
    revenue_surprise_percent: null,
    guidance: null,
    guidance_headline: null,
    guidance_url: null,
    spending_outlook: null,
    spending_headline: null,
    spending_url: null,
    estimate_change_percent: null,
  });

  const restored = fromStoredRows(symbolRow, [...reportRows].reverse());
  const blankExtras = { revenueEstimate: null, revenueActual: null, revenueSurprisePercent: null, guidance: null, spendingOutlook: null, estimateChangePercent: null };
  assert.deepEqual(restored, {
    ...collected,
    summary: { ...summary, history: summary.history.map((result) => ({ ...result, ...blankExtras })) },
    fetchedAt: "2026-10-29T23:00:00.000Z",
    lastError: null,
  });
});

test("toEstimateRows keeps one row per period for the night", () => {
  const rows = toEstimateRows(details, "2026-10-29");
  assert.deepEqual(
    rows.map((row) => `${row.period_type}:${row.fiscal_period}:${row.as_of_date}:${row.consensus}`),
    ["quarter:Sep 2026:2026-10-29:0.94", "year:Dec 2026:2026-10-29:3.2"]
  );
});

test("mergeHistory keeps quarters only the database remembers", () => {
  const older = { fiscalQuarter: "Jun 2025", reportedDate: "2025-08-06", eps: 0.63, consensusEps: 0.6, surprisePercent: 5 };
  const staleCopy = { ...summary.history[0], eps: 999 };
  const merged = mergeHistory(summary.history, [staleCopy, older]);
  assert.deepEqual(merged.map((result) => result.fiscalQuarter), ["Jun 2026", "Mar 2026", "Jun 2025"]);
  assert.equal(merged[0].eps, 1.17);
});

test("isStoredEarningsStale refreshes after 36h, and every 6h on report days", () => {
  const stored = (fetchedAt: string, date = "2026-11-04"): StoredEarnings => ({
    ...collected,
    summary: { ...summary, upcoming: { ...summary.upcoming!, date } },
    fetchedAt,
    lastError: null,
  });
  const now = new Date("2026-10-29T12:00:00Z");
  assert.equal(isStoredEarningsStale(stored("2026-10-28T23:00:00Z"), now), false);
  assert.equal(isStoredEarningsStale(stored("2026-10-27T23:00:00Z"), now), true);
  assert.equal(isStoredEarningsStale(stored("2026-10-29T08:00:00Z", "2026-10-29"), now), false);
  assert.equal(isStoredEarningsStale(stored("2026-10-29T05:00:00Z", "2026-10-29"), now), true);
  assert.equal(isStoredEarningsStale(stored("not a date"), now), true);
});

test("mapWithConcurrency keeps order and limits parallel work", async () => {
  let running = 0;
  let peak = 0;
  const results = await mapWithConcurrency([30, 10, 20, 5, 15], 2, async (delay) => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, delay));
    running -= 1;
    return delay * 2;
  });
  assert.deepEqual(results, [60, 20, 40, 10, 30]);
  assert.equal(peak, 2);
});

test("loadEarnings serves fresh stored rows without fetching", async () => {
  const symbolRow = toSymbolRow(collected, "2026-10-29T23:00:00.000Z");
  const reportRows = toReportRows(summary);
  const query = (rows: unknown[]) => ({
    in: () => {
      const result = Promise.resolve({ data: rows, error: null });
      return Object.assign(result, { order: () => result });
    },
  });
  const client = {
    from: (table: string) => ({ select: () => query(table === "earnings_symbols" ? [symbolRow] : reportRows) }),
  };

  const loaded = await loadEarnings(client, ["UBER"], new Date("2026-10-30T08:00:00Z"));
  assert.equal(loaded.get("UBER")?.summary.history.length, 2);
  assert.equal(loaded.get("UBER")?.fetchedAt, "2026-10-29T23:00:00.000Z");
});

test("getScheduledEarningsSymbols collects open stock positions across users", () => {
  const row = (overrides: Partial<HoldingRow>): HoldingRow => ({
    id: overrides.ticker ?? "x",
    user_id: "u1",
    platform: "IBKR",
    asset_name: overrides.ticker ?? "x",
    ticker: "META",
    asset_class: "Stocks",
    sector: "",
    geography: "US",
    risk: "Medium",
    quantity: 1,
    avg_buy_price: 1,
    current_price: 1,
    currency: "USD",
    notes: "",
    price_source: "alphavantage",
    scheme_code: null,
    last_price_update: null,
    price_as_of: null,
    price_session: null,
    previous_close: null,
    day_change_percent: null,
    purchases: null,
    ...overrides,
  });

  assert.deepEqual(
    getScheduledEarningsSymbols([
      row({ ticker: "META" }),
      row({ ticker: "META", user_id: "u2" }),
      row({ ticker: "9618.HK", geography: "Others" }),
      row({ ticker: "0700.HK", geography: "Others" }),
      row({ ticker: "IBIT", asset_class: "ETFs" }),
      row({ ticker: "PYPL", quantity: 0 }),
    ]),
    ["JD", "META"]
  );
});
