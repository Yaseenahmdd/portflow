import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchStockQuote } from "@/lib/api/alphavantage";
import { fetchQuarterRevenueEstimates } from "@/lib/api/alphavantage-estimates";
import { fetchFinnhubCompanyNews, fetchFinnhubEarnings } from "@/lib/api/finnhub";
import {
  fetchEarningsDetails,
  fetchEarningsSummary,
  type EarningsDetails,
  type EarningsResult,
  type EarningsSummary,
  type GuidanceDirection,
  type UpcomingEarnings,
} from "@/lib/api/nasdaq-earnings";
import { fetchHeadlines, type Headline } from "@/lib/api/yahoo-news";
import {
  applyFinnhubRevenue,
  applyGuidance,
  applyHistoricalRevenue,
  getCompanyTokens,
  getEstimateChange,
  getReportedRevenue,
} from "@/lib/earnings-enrich";
import { attachPriceReactions } from "@/lib/earnings-reactions";
import { createAdminClient } from "@/lib/supabase/admin";

const STALE_AFTER_MS = 36 * 60 * 60 * 1000;
// On report days, refresh a few times so results show up before the nightly run.
const REPORT_DAY_STALE_AFTER_MS = 6 * 60 * 60 * 1000;
const LIVE_FETCH_CONCURRENCY = 4;
// Finnhub's free plan covers about a month back; ask for a little more plus the next quarter.
const FINNHUB_LOOKBACK_DAYS = 40;
const FINNHUB_LOOKAHEAD_DAYS = 120;
// News for guidance: the report day and the day after (after-close reports
// make the next day's headlines), one day per call so busy stocks aren't cut
// off. The two most recent reports get both days, older ones a single call.
const NEWS_DETAILED_REPORTS = 2;
const NEWS_MAX_REPORT_AGE_DAYS = 400;
// Only recent reports can still gain a post-report estimate change.
const ESTIMATE_CHANGE_WINDOW_DAYS = 30;

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export interface CollectedEarnings {
  companyName: string | null;
  summary: EarningsSummary;
  details: EarningsDetails;
  headlines: Headline[];
  price: number | null;
}

export interface StoredEarnings extends CollectedEarnings {
  fetchedAt: string;
  lastError: string | null;
}

export interface EarningsSymbolRow {
  symbol: string;
  upcoming: UpcomingEarnings | null;
  details: Omit<EarningsDetails, "symbol">;
  headlines: Headline[];
  price: number | null;
  company_name?: string | null;
  fetched_at: string;
  last_error?: string | null;
}

export interface EarningsReportRow {
  symbol: string;
  fiscal_quarter: string;
  reported_date: string;
  eps: number | null;
  consensus_eps: number | null;
  surprise_percent: number | null;
  reaction_before_date: string | null;
  reaction_after_date: string | null;
  reaction_change_percent: number | null;
  revenue_estimate?: number | null;
  revenue_actual?: number | null;
  revenue_surprise_percent?: number | null;
  guidance?: string | null;
  guidance_headline?: string | null;
  guidance_url?: string | null;
  spending_outlook?: string | null;
  spending_headline?: string | null;
  spending_url?: string | null;
  estimate_change_percent?: number | null;
}

export interface EarningsEstimateRow {
  symbol: string;
  period_type: "quarter" | "year";
  fiscal_period: string;
  as_of_date: string;
  consensus: number | null;
  high: number | null;
  low: number | null;
  analysts: number | null;
  revisions_up: number | null;
  revisions_down: number | null;
}

/** Fetch everything for one symbol from the sources. `null` when nothing came back. */
// Revenue beat/miss is back-filled for this many recent reports.
const REVENUE_BACKFILL_REPORTS = 4;

/**
 * Fetch everything for one symbol from the sources. `null` when nothing came
 * back. `previousHistory` is what's already stored, so paid-for or rate-limited
 * lookups are skipped when they wouldn't add anything.
 */
export async function collectEarnings(
  symbol: string,
  today: string,
  previousHistory: EarningsResult[] = []
): Promise<CollectedEarnings | null> {
  const [summary, details, headlines, quote, finnhub] = await Promise.all([
    fetchEarningsSummary(symbol),
    fetchEarningsDetails(symbol),
    fetchHeadlines(symbol),
    fetchStockQuote(symbol),
    fetchFinnhubEarnings(symbol, addDays(today, -FINNHUB_LOOKBACK_DAYS), addDays(today, FINNHUB_LOOKAHEAD_DAYS)),
  ]);
  if (!summary && !details.quarterlyEstimates.length && !details.yearlyEstimates.length) return null;

  const withReactions = summary
    ? (await attachPriceReactions({ [summary.symbol]: summary }, today))[summary.symbol]
    : { symbol: symbol.toUpperCase(), upcoming: null, history: [] };
  const companyName = quote?.name ?? null;
  const newsRanges = withReactions.history
    .filter((result) => result.reportedDate >= addDays(today, -NEWS_MAX_REPORT_AGE_DAYS))
    .flatMap((result, index): Array<[string, string]> => {
      const nextDay = addDays(result.reportedDate, 1);
      return index < NEWS_DETAILED_REPORTS
        ? [[result.reportedDate, result.reportedDate], [nextDay, nextDay]]
        : [[result.reportedDate, nextDay]];
    });
  const reportNews = await Promise.all(newsRanges.map(([from, to]) => fetchFinnhubCompanyNews(symbol, from, to)));
  let withRevenue = applyFinnhubRevenue(withReactions, finnhub);
  const missingRevenue = mergeHistory(withRevenue.history, previousHistory)
    .slice(0, REVENUE_BACKFILL_REPORTS)
    .some((result) => result.revenueSurprisePercent == null && getReportedRevenue(details.reported, result.fiscalQuarter) !== null);
  if (missingRevenue) {
    const estimates = await fetchQuarterRevenueEstimates(symbol);
    if (estimates) withRevenue = applyHistoricalRevenue(withRevenue, estimates, details.reported);
  }
  const enriched = applyGuidance(
    withRevenue,
    [...headlines, ...reportNews.flat()],
    getCompanyTokens(symbol, companyName ?? undefined)
  );

  return { companyName, summary: enriched, details, headlines, price: quote?.price ?? null };
}

export function toSymbolRow(data: CollectedEarnings, fetchedAt: string): EarningsSymbolRow {
  const { symbol, ...details } = data.details;
  return {
    symbol,
    upcoming: data.summary.upcoming,
    details,
    headlines: data.headlines,
    price: data.price,
    company_name: data.companyName,
    fetched_at: fetchedAt,
    last_error: null,
  };
}

export function toReportRows(summary: EarningsSummary): EarningsReportRow[] {
  return summary.history.map((result) => ({
    symbol: summary.symbol,
    fiscal_quarter: result.fiscalQuarter,
    reported_date: result.reportedDate,
    eps: result.eps,
    consensus_eps: result.consensusEps,
    surprise_percent: result.surprisePercent,
    reaction_before_date: result.priceReaction?.beforeDate ?? null,
    reaction_after_date: result.priceReaction?.afterDate ?? null,
    reaction_change_percent: result.priceReaction?.changePercent ?? null,
    revenue_estimate: result.revenueEstimate ?? null,
    revenue_actual: result.revenueActual ?? null,
    revenue_surprise_percent: result.revenueSurprisePercent ?? null,
    guidance: result.guidance?.direction ?? null,
    guidance_headline: result.guidance?.headline ?? null,
    guidance_url: result.guidance?.url ?? null,
    spending_outlook: result.spendingOutlook?.direction ?? null,
    spending_headline: result.spendingOutlook?.headline ?? null,
    spending_url: result.spendingOutlook?.url ?? null,
    estimate_change_percent: result.estimateChangePercent ?? null,
  }));
}

const KEEP_IF_MISSING: Array<keyof EarningsReportRow> = [
  "eps",
  "consensus_eps",
  "surprise_percent",
  "reaction_before_date",
  "reaction_after_date",
  "reaction_change_percent",
  "revenue_estimate",
  "revenue_actual",
  "revenue_surprise_percent",
  "guidance",
  "guidance_headline",
  "guidance_url",
  "spending_outlook",
  "spending_headline",
  "spending_url",
  "estimate_change_percent",
];

/**
 * Sources forget older quarters (Finnhub keeps about a month), so a fresh
 * row never blanks out a value the database already has.
 */
export function mergeReportRows(fresh: EarningsReportRow[], existing: EarningsReportRow[]): EarningsReportRow[] {
  const byQuarter = new Map(existing.map((row) => [row.fiscal_quarter, row]));
  return fresh.map((row) => {
    const previous = byQuarter.get(row.fiscal_quarter);
    if (!previous) return row;
    const merged: Record<string, unknown> = { ...row };
    for (const key of KEEP_IF_MISSING) {
      if (merged[key] == null && previous[key] != null) merged[key] = previous[key];
    }
    return merged as unknown as EarningsReportRow;
  });
}

export function toEstimateRows(details: EarningsDetails, asOfDate: string): EarningsEstimateRow[] {
  const rows = (periodType: "quarter" | "year", estimates: EarningsDetails["quarterlyEstimates"]) =>
    estimates.map((estimate) => ({
      symbol: details.symbol,
      period_type: periodType,
      fiscal_period: estimate.fiscalPeriod,
      as_of_date: asOfDate,
      consensus: estimate.consensus,
      high: estimate.high,
      low: estimate.low,
      analysts: estimate.analysts,
      revisions_up: estimate.revisionsUp,
      revisions_down: estimate.revisionsDown,
    }));
  return [...rows("quarter", details.quarterlyEstimates), ...rows("year", details.yearlyEstimates)];
}

function fromReportRow(row: EarningsReportRow): EarningsResult {
  return {
    fiscalQuarter: row.fiscal_quarter,
    reportedDate: row.reported_date,
    eps: row.eps,
    consensusEps: row.consensus_eps,
    surprisePercent: row.surprise_percent,
    priceReaction:
      row.reaction_before_date && row.reaction_after_date && row.reaction_change_percent !== null
        ? { beforeDate: row.reaction_before_date, afterDate: row.reaction_after_date, changePercent: row.reaction_change_percent }
        : null,
    revenueEstimate: row.revenue_estimate ?? null,
    revenueActual: row.revenue_actual ?? null,
    revenueSurprisePercent: row.revenue_surprise_percent ?? null,
    guidance:
      row.guidance && row.guidance_headline && row.guidance_url
        ? { direction: row.guidance as GuidanceDirection, headline: row.guidance_headline, url: row.guidance_url }
        : null,
    spendingOutlook:
      row.spending_outlook && row.spending_headline && row.spending_url
        ? { direction: row.spending_outlook as GuidanceDirection, headline: row.spending_headline, url: row.spending_url }
        : null,
    estimateChangePercent: row.estimate_change_percent ?? null,
  };
}

export function fromStoredRows(symbolRow: EarningsSymbolRow, reportRows: EarningsReportRow[]): StoredEarnings {
  return {
    companyName: symbolRow.company_name ?? null,
    summary: {
      symbol: symbolRow.symbol,
      upcoming: symbolRow.upcoming,
      history: reportRows.map(fromReportRow).sort((a, b) => b.reportedDate.localeCompare(a.reportedDate)),
    },
    details: { symbol: symbolRow.symbol, ...symbolRow.details },
    headlines: symbolRow.headlines ?? [],
    price: symbolRow.price,
    fetchedAt: symbolRow.fetched_at,
    lastError: symbolRow.last_error ?? null,
  };
}

/** Fresh results win field by field; quarters only the database still remembers are kept. */
export function mergeHistory(fresh: EarningsResult[], stored: EarningsResult[]) {
  const storedByQuarter = new Map(stored.map((result) => [result.fiscalQuarter, result]));
  const merged = fresh.map((result) => {
    const previous = storedByQuarter.get(result.fiscalQuarter);
    if (!previous) return result;
    const combined: Record<string, unknown> = { ...previous };
    for (const [key, value] of Object.entries(result)) {
      if (value != null) combined[key] = value;
    }
    return combined as unknown as EarningsResult;
  });
  const seen = new Set(fresh.map((result) => result.fiscalQuarter));
  return [...merged, ...stored.filter((result) => !seen.has(result.fiscalQuarter))].sort((a, b) =>
    b.reportedDate.localeCompare(a.reportedDate)
  );
}

export function isStoredEarningsStale(stored: StoredEarnings, now: Date) {
  const age = now.getTime() - Date.parse(stored.fetchedAt);
  if (!Number.isFinite(age) || age > STALE_AFTER_MS) return true;
  const today = now.toISOString().slice(0, 10);
  const reportDate = stored.summary.upcoming?.date;
  return Boolean(reportDate && reportDate <= today && age > REPORT_DAY_STALE_AFTER_MS);
}

export async function saveEarnings(admin: SupabaseClient, data: CollectedEarnings, now: Date) {
  const fetchedAt = now.toISOString();
  const { error: symbolError } = await admin
    .from("earnings_symbols")
    .upsert(toSymbolRow(data, fetchedAt), { onConflict: "symbol" });
  if (symbolError) throw new Error(symbolError.message);

  const today = fetchedAt.slice(0, 10);
  const estimates = toEstimateRows(data.details, today);
  if (estimates.length) {
    const { error } = await admin
      .from("earnings_estimate_history")
      .upsert(estimates, { onConflict: "symbol,period_type,fiscal_period,as_of_date" });
    if (error) throw new Error(error.message);
  }

  const reports = toReportRows(data.summary);
  if (!reports.length) return;

  const { data: existing, error: existingError } = await admin
    .from("earnings_reports")
    .select("*")
    .eq("symbol", data.summary.symbol);
  if (existingError) throw new Error(existingError.message);
  const merged = mergeReportRows(reports, (existing ?? []) as EarningsReportRow[]);

  const fullYear = data.details.yearlyEstimates[0]?.fiscalPeriod;
  const recent = merged.filter(
    (row) => row.estimate_change_percent == null && row.reported_date >= addDays(today, -ESTIMATE_CHANGE_WINDOW_DAYS)
  );
  if (fullYear && recent.length) {
    const { data: points, error: pointsError } = await admin
      .from("earnings_estimate_history")
      .select("as_of_date, consensus")
      .eq("symbol", data.summary.symbol)
      .eq("period_type", "year")
      .eq("fiscal_period", fullYear);
    if (pointsError) throw new Error(pointsError.message);
    const series = ((points ?? []) as Array<{ as_of_date: string; consensus: number | null }>).map((point) => ({
      asOfDate: point.as_of_date,
      consensus: point.consensus,
    }));
    for (const row of recent) row.estimate_change_percent = getEstimateChange(series, row.reported_date);
  }

  const { error } = await admin.from("earnings_reports").upsert(merged, { onConflict: "symbol,fiscal_quarter" });
  if (error) throw new Error(error.message);
}

/** Keeps the last good data and notes why this refresh failed. */
export async function recordEarningsFailure(admin: SupabaseClient, symbol: string, message: string, now: Date) {
  const { error } = await admin
    .from("earnings_symbols")
    .update({ last_error: message.slice(0, 500), last_error_at: now.toISOString() })
    .eq("symbol", symbol);
  if (error) throw new Error(error.message);
}

export async function readStoredEarnings(client: SupabaseClient, symbols: string[]) {
  const stored = new Map<string, StoredEarnings>();
  if (!symbols.length) return stored;

  const [symbolsResult, reportsResult] = await Promise.all([
    client.from("earnings_symbols").select("*").in("symbol", symbols),
    client.from("earnings_reports").select("*").in("symbol", symbols).order("reported_date", { ascending: false }),
  ]);
  if (symbolsResult.error) throw new Error(symbolsResult.error.message);
  if (reportsResult.error) throw new Error(reportsResult.error.message);

  const reportsBySymbol = new Map<string, EarningsReportRow[]>();
  for (const row of (reportsResult.data ?? []) as EarningsReportRow[]) {
    reportsBySymbol.set(row.symbol, [...(reportsBySymbol.get(row.symbol) ?? []), row]);
  }
  for (const row of (symbolsResult.data ?? []) as EarningsSymbolRow[]) {
    stored.set(row.symbol, fromStoredRows(row, reportsBySymbol.get(row.symbol) ?? []));
  }
  return stored;
}

export async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index]);
      }
    })
  );
  return results;
}

function tryCreateAdminClient() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

function hasDatabase(client: unknown): client is SupabaseClient {
  return typeof (client as { from?: unknown } | null)?.from === "function";
}

/**
 * Earnings for the requested symbols: stored rows when fresh, a live fetch
 * (saved for next time) when missing or stale, and stale rows as a last resort.
 * Without a database (demo mode) everything is fetched live.
 */
export async function loadEarnings(client: unknown, symbols: string[], now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  let stored = new Map<string, StoredEarnings>();
  if (hasDatabase(client)) {
    try {
      stored = await readStoredEarnings(client, symbols);
    } catch (error) {
      // The tables may not exist yet (migration not applied); fall back to live data.
      console.error("[earnings] Failed to read stored earnings:", error);
    }
  }

  const toFetch = symbols.filter((symbol) => {
    const row = stored.get(symbol);
    return !row || isStoredEarningsStale(row, now);
  });
  const admin = toFetch.length && hasDatabase(client) ? tryCreateAdminClient() : null;

  const fresh = await mapWithConcurrency(toFetch, LIVE_FETCH_CONCURRENCY, async (symbol) => {
    const data = await collectEarnings(symbol, today, stored.get(symbol)?.summary.history);
    if (data && admin) {
      await saveEarnings(admin, data, now).catch((error) => console.error(`[earnings] Failed to save ${symbol}:`, error));
    }
    return data;
  });

  const result = new Map<string, StoredEarnings>(stored);
  toFetch.forEach((symbol, index) => {
    const data = fresh[index];
    if (!data) return;
    const previous = stored.get(symbol);
    result.set(symbol, {
      ...data,
      summary: { ...data.summary, history: mergeHistory(data.summary.history, previous?.summary.history ?? []) },
      fetchedAt: now.toISOString(),
      lastError: null,
    });
  });
  return result;
}
