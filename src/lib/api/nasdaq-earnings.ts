/**
 * Nasdaq earnings helper (Zacks data) for US-listed stocks and ADRs.
 * No API key required.
 */

export type EarningsTiming = "pre-market" | "after-hours";
export type EarningsDateStatus = "confirmed" | "estimated" | "projected";

export interface PriceReaction {
  beforeDate: string; // last close before the report
  afterDate: string; // first close after the report
  changePercent: number;
}

export type GuidanceDirection = "raised" | "lowered" | "reaffirmed";

export interface GuidanceSignal {
  direction: GuidanceDirection;
  headline: string;
  url: string;
}

export interface EarningsResult {
  fiscalQuarter: string;
  reportedDate: string; // YYYY-MM-DD
  eps: number | null;
  consensusEps: number | null;
  surprisePercent: number | null;
  priceReaction?: PriceReaction | null;
  // Revenue is in the company's reporting currency; compare it as a ratio.
  revenueEstimate?: number | null;
  revenueActual?: number | null;
  revenueSurprisePercent?: number | null;
  guidance?: GuidanceSignal | null;
  // Capex/cost outlook, kept apart because a higher spending plan isn't a raised forecast.
  spendingOutlook?: GuidanceSignal | null;
  // Change in the full-year EPS consensus from before the report to after it.
  estimateChangePercent?: number | null;
}

export interface UpcomingEarnings {
  date: string; // YYYY-MM-DD
  status: EarningsDateStatus;
  timing?: EarningsTiming;
  fiscalQuarter?: string;
  consensusEps?: number;
  lastYearEps?: number;
  revenueEstimate?: number;
}

export interface EarningsSummary {
  symbol: string;
  upcoming: UpcomingEarnings | null;
  history: EarningsResult[];
}

const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_SECONDS = 6 * 60 * 60;
const AVERAGE_QUARTER_DAYS = 91;

const NASDAQ_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

function parseUsDate(value: string | undefined): string | null {
  const match = value?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/**
 * Nasdaq only exposes the upcoming date as prose, e.g.
 * "... is expected* to report earnings on 11/04/2026 before market open."
 */
export function parseEarningsDateText(reportText: string | undefined): UpcomingEarnings | null {
  if (!reportText) return null;
  const date = parseUsDate(reportText.match(/report earnings on\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]);
  if (!date) return null;

  const timing: EarningsTiming | undefined = /before market open/i.test(reportText)
    ? "pre-market"
    : /after market close/i.test(reportText)
      ? "after-hours"
      : undefined;
  const consensusEps = parseNumber(reportText.match(/consensus EPS forecast for the quarter is \$?(-?\d+(?:\.\d+)?)/i)?.[1]);
  const lastYearEps = parseNumber(reportText.match(/same quarter last year was \$?(-?\d+(?:\.\d+)?)/i)?.[1]);

  return {
    date,
    status: /is estimated to report/i.test(reportText) ? "estimated" : "confirmed",
    timing,
    fiscalQuarter: reportText.match(/fiscal Quarter ending\s+([A-Za-z]{3} \d{4})/i)?.[1],
    consensusEps: consensusEps ?? undefined,
    lastYearEps: lastYearEps ?? undefined,
  };
}

interface NasdaqSurpriseRow {
  fiscalQtrEnd?: string;
  dateReported?: string;
  eps?: number | string;
  consensusForecast?: number | string;
  percentageSurprise?: number | string;
}

export function parseEarningsSurpriseRows(rows: NasdaqSurpriseRow[] | undefined): EarningsResult[] {
  return (rows ?? [])
    .map((row) => {
      const reportedDate = parseUsDate(row.dateReported);
      if (!reportedDate) return null;
      return {
        fiscalQuarter: row.fiscalQtrEnd ?? "",
        reportedDate,
        eps: parseNumber(row.eps),
        consensusEps: parseNumber(row.consensusForecast),
        surprisePercent: parseNumber(row.percentageSurprise),
      };
    })
    .filter((row): row is EarningsResult => row !== null)
    .sort((a, b) => b.reportedDate.localeCompare(a.reportedDate));
}

/**
 * When Zacks has no date yet (usually right after a report), project the next
 * one a quarter after the latest report so the holding still has a horizon.
 */
export function projectNextEarnings(history: EarningsResult[], today: string): UpcomingEarnings | null {
  const latest = history[0];
  if (!latest) return null;
  let date = addDays(latest.reportedDate, AVERAGE_QUARTER_DAYS);
  while (date < today) date = addDays(date, AVERAGE_QUARTER_DAYS);
  // Companies report on weekdays: move Saturday back and Sunday forward.
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (weekday === 6) date = addDays(date, -1);
  if (weekday === 0) date = addDays(date, 1);
  return { date, status: "projected" };
}

async function fetchNasdaqJson(path: string) {
  const res = await fetch(`https://api.nasdaq.com/api/${path}`, {
    headers: NASDAQ_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: CACHE_SECONDS },
  });
  if (!res.ok) throw new Error(`Nasdaq error: ${res.status}`);
  return res.json();
}

export async function fetchEarningsSummary(symbol: string): Promise<EarningsSummary | null> {
  const encoded = encodeURIComponent(symbol.toUpperCase());
  const [dateResult, surpriseResult] = await Promise.allSettled([
    fetchNasdaqJson(`analyst/${encoded}/earnings-date`),
    fetchNasdaqJson(`company/${encoded}/earnings-surprise`),
  ]);

  const history =
    surpriseResult.status === "fulfilled"
      ? parseEarningsSurpriseRows(surpriseResult.value?.data?.earningsSurpriseTable?.rows)
      : [];
  const upcoming =
    dateResult.status === "fulfilled" ? parseEarningsDateText(dateResult.value?.data?.reportText) : null;

  if (dateResult.status === "rejected" && surpriseResult.status === "rejected") {
    console.error(`Nasdaq earnings: failed to fetch ${symbol}:`, dateResult.reason);
    return null;
  }
  if (!upcoming && !history.length) return null;

  const today = new Date().toISOString().slice(0, 10);
  return {
    symbol: symbol.toUpperCase(),
    upcoming: upcoming && upcoming.date >= today ? upcoming : projectNextEarnings(history, today),
    history,
  };
}

export async function fetchEarningsSummaries(symbols: string[]): Promise<Record<string, EarningsSummary>> {
  const results: Record<string, EarningsSummary> = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      const summary = await fetchEarningsSummary(symbol);
      if (summary) results[summary.symbol] = summary;
    })
  );
  return results;
}

export interface EpsEstimate {
  fiscalPeriod: string;
  consensus: number | null;
  high: number | null;
  low: number | null;
  analysts: number | null;
  revisionsUp: number | null;
  revisionsDown: number | null;
}

export interface EstimateMomentum {
  quarterNow: number | null;
  quarterMonthAgo: number | null;
  yearNow: number | null;
  yearMonthAgo: number | null;
}

export interface ReportedQuarter {
  periodEnd: string; // YYYY-MM-DD
  revenueMillions: number | null;
  eps: number | null;
}

export interface AnalystView {
  buy: number;
  hold: number;
  sell: number;
  targetMean: number | null;
  targetLow: number | null;
  targetHigh: number | null;
}

export interface EarningsDetails {
  symbol: string;
  quarterlyEstimates: EpsEstimate[];
  yearlyEstimates: EpsEstimate[];
  momentum: EstimateMomentum | null;
  reported: ReportedQuarter[];
  analysts: AnalystView | null;
}

interface NasdaqForecastRow {
  fiscalEnd?: string;
  consensusEPSForecast?: number | string;
  highEPSForecast?: number | string;
  lowEPSForecast?: number | string;
  noOfEstimates?: number | string;
  up?: number | string;
  down?: number | string;
}

export function parseForecastRows(rows: NasdaqForecastRow[] | undefined): EpsEstimate[] {
  return (rows ?? [])
    .filter((row) => row.fiscalEnd)
    .map((row) => ({
      fiscalPeriod: row.fiscalEnd!,
      consensus: parseNumber(row.consensusEPSForecast),
      high: parseNumber(row.highEPSForecast),
      low: parseNumber(row.lowEPSForecast),
      analysts: parseNumber(row.noOfEstimates),
      revisionsUp: parseNumber(row.up),
      revisionsDown: parseNumber(row.down),
    }));
}

function parseMoney(value: string | undefined): number | null {
  if (!value || value === "N/A") return null;
  // "($0.32)" is negative, "$13,203(m)" is millions.
  const negative = /^\(.*\)/.test(value.trim());
  const parsed = parseNumber(value.replace(/\(m\)/i, "").replace(/\(\d{1,2}\/\d{1,2}\/\d{4}\)/, "").replace(/[()]/g, "").trim());
  return parsed === null ? null : negative ? -parsed : parsed;
}

/**
 * Nasdaq's revenue table groups rows as label / Revenue / EPS / Dividends per
 * quarter, one column per fiscal year. The quarter labels are unreliable, so
 * the period end comes from the date printed next to each EPS figure.
 */
export function parseRevenueTable(rows: Array<Record<string, string>> | undefined): ReportedQuarter[] {
  const quarters: ReportedQuarter[] = [];
  const list = rows ?? [];
  for (let index = 0; index < list.length; index += 1) {
    if (list[index]?.value1 !== "Revenue" || list[index + 1]?.value1 !== "EPS") continue;
    const revenueRow = list[index];
    const epsRow = list[index + 1];
    for (const column of ["value2", "value3", "value4", "value5"]) {
      const periodEnd = parseUsDate(epsRow[column]);
      if (!periodEnd) continue;
      quarters.push({
        periodEnd,
        revenueMillions: parseMoney(revenueRow[column]),
        eps: parseMoney(epsRow[column]),
      });
    }
  }
  return quarters.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
}

interface NasdaqForecastData {
  quarterlyForecast?: { rows?: NasdaqForecastRow[] };
  yearlyForecast?: { rows?: NasdaqForecastRow[] };
}

interface NasdaqMomentumData {
  changeInConsensus?: {
    currentData?: { qtrMean?: number; yrMean?: number };
    monthData?: { qtrMean?: number; yrMean?: number };
  };
}

interface NasdaqRevenueData {
  revenueTable?: { rows?: Array<Record<string, string>> } | null;
}

interface NasdaqTargetData {
  consensusOverview?: {
    buy?: number;
    hold?: number;
    sell?: number;
    priceTarget?: number;
    lowPriceTarget?: number;
    highPriceTarget?: number;
  };
}

async function fetchOptional<D, T>(path: string, parse: (data: D | undefined) => T): Promise<T | null> {
  try {
    return parse((await fetchNasdaqJson(path))?.data as D | undefined);
  } catch (error) {
    console.error(`Nasdaq earnings: failed to fetch ${path}:`, error);
    return null;
  }
}

export async function fetchEarningsDetails(symbol: string): Promise<EarningsDetails> {
  const encoded = encodeURIComponent(symbol.toUpperCase());
  const [forecast, momentum, reported, analysts] = await Promise.all([
    fetchOptional(`analyst/${encoded}/earnings-forecast`, (data: NasdaqForecastData | undefined) => ({
      quarterly: parseForecastRows(data?.quarterlyForecast?.rows),
      yearly: parseForecastRows(data?.yearlyForecast?.rows),
    })),
    fetchOptional(`analyst/${encoded}/estimate-momentum`, (data: NasdaqMomentumData | undefined): EstimateMomentum | null => {
      const change = data?.changeInConsensus;
      if (!change) return null;
      return {
        quarterNow: parseNumber(change.currentData?.qtrMean),
        quarterMonthAgo: parseNumber(change.monthData?.qtrMean),
        yearNow: parseNumber(change.currentData?.yrMean),
        yearMonthAgo: parseNumber(change.monthData?.yrMean),
      };
    }),
    fetchOptional(`company/${encoded}/revenue?limit=1`, (data: NasdaqRevenueData | undefined) => parseRevenueTable(data?.revenueTable?.rows)),
    fetchOptional(`analyst/${encoded}/targetprice`, (data: NasdaqTargetData | undefined): AnalystView | null => {
      const overview = data?.consensusOverview;
      if (!overview) return null;
      return {
        buy: parseNumber(overview.buy) ?? 0,
        hold: parseNumber(overview.hold) ?? 0,
        sell: parseNumber(overview.sell) ?? 0,
        targetMean: parseNumber(overview.priceTarget),
        targetLow: parseNumber(overview.lowPriceTarget),
        targetHigh: parseNumber(overview.highPriceTarget),
      };
    }),
  ]);

  return {
    symbol: symbol.toUpperCase(),
    quarterlyEstimates: forecast?.quarterly ?? [],
    yearlyEstimates: forecast?.yearly ?? [],
    momentum: momentum ?? null,
    reported: reported ?? [],
    analysts: analysts ?? null,
  };
}
