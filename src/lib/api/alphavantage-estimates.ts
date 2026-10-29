/**
 * Alpha Vantage EARNINGS_ESTIMATES: the final revenue consensus for past and
 * upcoming quarters. Needs ALPHA_VANTAGE_API_KEY. The free plan allows 25
 * calls a day and a few a minute, so callers only ask when a stored report is
 * still missing its revenue result.
 */

export interface QuarterRevenueEstimate {
  periodEnd: string; // YYYY-MM-DD fiscal quarter end
  revenueEstimate: number;
}

interface EstimatesRow {
  date?: string;
  horizon?: string;
  revenue_estimate_average?: string;
}

const BASE_URL = "https://www.alphavantage.co/query";
const REQUEST_TIMEOUT_MS = 10_000;
// Calls closer together than this get throttled on the free plan; skip
// instead of waiting so a refresh never stalls.
const MIN_CALL_GAP_MS = 13_000;
let lastCallAt = 0;

export function parseRevenueEstimates(rows: EstimatesRow[] | undefined): QuarterRevenueEstimate[] {
  return (rows ?? [])
    .filter((row) => row.horizon === "fiscal quarter" && typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .map((row) => ({ periodEnd: row.date!, revenueEstimate: Number(row.revenue_estimate_average) }))
    .filter((row) => Number.isFinite(row.revenueEstimate) && row.revenueEstimate > 0)
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
}

/** `null` when skipped, throttled or failed, so callers can try again later. */
export async function fetchQuarterRevenueEstimates(symbol: string): Promise<QuarterRevenueEstimate[] | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey || Date.now() - lastCallAt < MIN_CALL_GAP_MS) return null;
  lastCallAt = Date.now();

  const params = new URLSearchParams({ function: "EARNINGS_ESTIMATES", symbol: symbol.toUpperCase(), apikey: apiKey });
  try {
    const res = await fetch(`${BASE_URL}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Alpha Vantage error: ${res.status}`);
    const body = (await res.json()) as { estimates?: EstimatesRow[]; Information?: string; Note?: string };
    // Rate-limit and plan messages come back as 200s with a note instead of data.
    if (!body.estimates) {
      console.warn(`Alpha Vantage: no estimates for ${symbol}:`, body.Information ?? body.Note ?? "empty response");
      return null;
    }
    return parseRevenueEstimates(body.estimates);
  } catch (error) {
    console.error(`Alpha Vantage: failed to fetch estimates for ${symbol}:`, error);
    return null;
  }
}
