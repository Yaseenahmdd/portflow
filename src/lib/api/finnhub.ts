/**
 * Finnhub earnings calendar (revenue estimates and actuals per report) and
 * company news (used to spot guidance changes around reports).
 * Needs FINNHUB_API_KEY (free plan: US listings, roughly the last month of
 * reports plus upcoming ones). Without a key every call returns nothing.
 */

import type { EarningsTiming } from "@/lib/api/nasdaq-earnings";
import type { Headline } from "@/lib/api/yahoo-news";

export interface FinnhubEarningsEntry {
  date: string; // YYYY-MM-DD
  timing?: EarningsTiming;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
}

interface FinnhubCalendarRow {
  date?: string;
  hour?: string;
  epsEstimate?: number | null;
  epsActual?: number | null;
  revenueEstimate?: number | null;
  revenueActual?: number | null;
}

const BASE_URL = "https://finnhub.io/api/v1";
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_SECONDS = 6 * 60 * 60;
// The free plan allows 60 calls a minute; stay a little under it.
const CALLS_PER_MINUTE = 55;
const recentCalls: number[] = [];

async function waitForRateLimit() {
  for (;;) {
    const now = Date.now();
    while (recentCalls.length && now - recentCalls[0] >= 60_000) recentCalls.shift();
    if (recentCalls.length < CALLS_PER_MINUTE) {
      recentCalls.push(now);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 60_000 - (now - recentCalls[0]) + 50));
  }
}

function finiteOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseFinnhubCalendar(rows: FinnhubCalendarRow[] | undefined): FinnhubEarningsEntry[] {
  return (rows ?? [])
    .filter((row) => typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .map((row) => ({
      date: row.date!,
      timing: (row.hour === "bmo" ? "pre-market" : row.hour === "amc" ? "after-hours" : undefined) as EarningsTiming | undefined,
      epsEstimate: finiteOrNull(row.epsEstimate),
      epsActual: finiteOrNull(row.epsActual),
      revenueEstimate: finiteOrNull(row.revenueEstimate),
      revenueActual: finiteOrNull(row.revenueActual),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function hasFinnhubKey() {
  return Boolean(process.env.FINNHUB_API_KEY);
}

export async function fetchFinnhubEarnings(symbol: string, from: string, to: string): Promise<FinnhubEarningsEntry[]> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return [];
  const params = new URLSearchParams({ symbol: symbol.toUpperCase(), from, to, token });
  try {
    await waitForRateLimit();
    const res = await fetch(`${BASE_URL}/calendar/earnings?${params}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate: CACHE_SECONDS },
    });
    if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);
    const body = (await res.json()) as { earningsCalendar?: FinnhubCalendarRow[] };
    return parseFinnhubCalendar(body.earningsCalendar);
  } catch (error) {
    console.error(`Finnhub: failed to fetch earnings for ${symbol}:`, error);
    return [];
  }
}

interface FinnhubNewsRow {
  datetime?: number;
  headline?: string;
  url?: string;
}

export function parseFinnhubNews(rows: FinnhubNewsRow[] | undefined): Headline[] {
  return (rows ?? [])
    .filter((row) => row.headline && typeof row.url === "string" && /^https:\/\//.test(row.url) && typeof row.datetime === "number")
    .map((row) => ({
      title: row.headline!.trim(),
      url: row.url!,
      publishedAt: new Date(row.datetime! * 1000).toISOString(),
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/**
 * Company news for a date range (free plan: about a year back, US listings).
 * Each response holds roughly the newest 250 items, so busy stocks need
 * one-day ranges to reach the start of a report day.
 */
export async function fetchFinnhubCompanyNews(symbol: string, from: string, to: string): Promise<Headline[]> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return [];
  const params = new URLSearchParams({ symbol: symbol.toUpperCase(), from, to, token });
  try {
    await waitForRateLimit();
    const res = await fetch(`${BASE_URL}/company-news?${params}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate: CACHE_SECONDS },
    });
    if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);
    return parseFinnhubNews((await res.json()) as FinnhubNewsRow[]);
  } catch (error) {
    console.error(`Finnhub: failed to fetch news for ${symbol}:`, error);
    return [];
  }
}
