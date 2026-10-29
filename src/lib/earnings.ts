import { isHongKongTicker, type ComputedHolding } from "@/lib/constants";
import type { EarningsResult, EarningsSummary } from "@/lib/api/nasdaq-earnings";

// Hong Kong listings that report through a US listing of the same company.
const HK_EARNINGS_ALIASES: Record<string, string> = {
  "9618.HK": "JD",
  "9988.HK": "BABA",
  "9888.HK": "BIDU",
  "2015.HK": "LI",
  "9866.HK": "NIO",
  "9868.HK": "XPEV",
  "9961.HK": "TCOM",
  "9999.HK": "NTES",
  "9626.HK": "BILI",
};

export interface EarningsPosition {
  symbol: string;
  holdings: ComputedHolding[];
  valueAed: number;
  weightPercent: number;
}

export interface EarningsCoverage {
  positions: EarningsPosition[];
  uncovered: ComputedHolding[];
}

/**
 * Earnings symbol for a holding, `null` when the company reports earnings but
 * Nasdaq has no coverage, or `undefined` when earnings do not apply.
 */
export function getEarningsSymbol(holding: Pick<ComputedHolding, "ticker" | "assetClass" | "geography" | "priceSource">) {
  if (holding.assetClass !== "Stocks") return undefined;
  const ticker = holding.ticker.trim().toUpperCase();
  if (!ticker) return null;
  if (isHongKongTicker(ticker)) return HK_EARNINGS_ALIASES[ticker] ?? null;
  if (holding.geography === "India" || holding.geography === "UAE" || holding.priceSource === "dfm") return null;
  if (ticker.startsWith("NSE:") || /\.(NS|BO|L|TO|V|AX|DE|PA|AS|SW|T|SS|SZ|SI|KS|KQ|TW)$/.test(ticker)) return null;
  return /^[A-Z][A-Z.-]{0,9}$/.test(ticker) ? ticker : null;
}

export function getEarningsCoverage(holdings: ComputedHolding[], totalValueAed: number): EarningsCoverage {
  const bySymbol = new Map<string, EarningsPosition>();
  const uncovered: ComputedHolding[] = [];

  for (const holding of holdings) {
    if (holding.quantity <= 0) continue;
    const symbol = getEarningsSymbol(holding);
    if (symbol === undefined) continue;
    if (symbol === null) {
      uncovered.push(holding);
      continue;
    }
    const position = bySymbol.get(symbol) ?? { symbol, holdings: [], valueAed: 0, weightPercent: 0 };
    position.holdings.push(holding);
    position.valueAed += holding.currentValueAed;
    bySymbol.set(symbol, position);
  }

  const positions = [...bySymbol.values()].map((position) => ({
    ...position,
    weightPercent: totalValueAed > 0 ? (position.valueAed / totalValueAed) * 100 : 0,
  }));

  return { positions, uncovered };
}

export interface EarningsRow extends EarningsPosition {
  summary: EarningsSummary | null;
}

export function sortByNextEarnings(rows: EarningsRow[]) {
  return [...rows].sort((a, b) => {
    const aDate = a.summary?.upcoming?.date ?? "9999-12-31";
    const bDate = b.summary?.upcoming?.date ?? "9999-12-31";
    return aDate.localeCompare(bDate) || b.valueAed - a.valueAed;
  });
}

/** Whole days from `today` to `date`, both YYYY-MM-DD. */
export function daysUntil(date: string, today: string) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** Consecutive beats (positive) or misses (negative) from the latest report. */
export function getSurpriseStreak(summary: EarningsSummary | null) {
  let streak = 0;
  for (const result of summary?.history ?? []) {
    if (result.surprisePercent === null || result.surprisePercent === 0) break;
    const beat = result.surprisePercent > 0;
    if (streak === 0) streak = beat ? 1 : -1;
    else if (beat === streak > 0) streak += beat ? 1 : -1;
    else break;
  }
  return streak;
}

/** Today's date in the viewer's timezone as YYYY-MM-DD. */
export function localToday() {
  return new Date().toLocaleDateString("en-CA");
}

export function formatEarningsDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function formatDaysUntil(days: number) {
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

export function formatRevenue(millions: number | null) {
  if (millions === null) return "—";
  return millions >= 1000 ? `$${(millions / 1000).toFixed(1)}B` : `$${Math.round(millions)}M`;
}

export function formatSignedPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(Math.abs(value) >= 100 ? 0 : 1)}%`;
}

/** Gain/loss text color for a signed value. */
export function toneClass(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return "text-text-muted";
  return value > 0 ? "text-accent-gain" : "text-accent-loss";
}

export function formatEps(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value < 0 ? "-" : ""}$${Math.abs(value).toFixed(2)}`;
}

export interface ReportedItem {
  key: string;
  row: EarningsRow;
  result: EarningsResult;
}

/** Every report from the held stocks in the last `days`, newest first. */
export function getReportedTimeline(rows: EarningsRow[], today: string, days = 366): ReportedItem[] {
  return rows
    .flatMap((row) =>
      (row.summary?.history ?? [])
        .filter((result) => daysUntil(result.reportedDate, today) <= 0 && daysUntil(result.reportedDate, today) >= -days)
        .map((result) => ({ key: `${row.symbol}-${result.reportedDate}`, row, result }))
    )
    .sort((a, b) => b.result.reportedDate.localeCompare(a.result.reportedDate) || b.row.valueAed - a.row.valueAed);
}

export function summarizeReported(items: ReportedItem[]) {
  const surprises = items
    .map((item) => item.result.surprisePercent)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const middle = Math.floor(surprises.length / 2);
  const medianSurprise = !surprises.length
    ? null
    : surprises.length % 2
      ? surprises[middle]
      : (surprises[middle - 1] + surprises[middle]) / 2;
  const biggestMove = items.reduce<ReportedItem | null>((best, item) => {
    const move = item.result.priceReaction?.changePercent;
    if (move === undefined) return best;
    const bestMove = best?.result.priceReaction?.changePercent;
    return bestMove === undefined || Math.abs(move) > Math.abs(bestMove) ? item : best;
  }, null);

  return {
    beats: surprises.filter((value) => value > 0).length,
    misses: surprises.filter((value) => value < 0).length,
    medianSurprise,
    biggestMove,
  };
}

export type ResultOutcome = "beat" | "miss" | "inline";

/** Beat or miss from a surprise percent; within ±0.5% counts as in line. */
export function getOutcome(surprisePercent: number | null | undefined): ResultOutcome | null {
  if (surprisePercent === null || surprisePercent === undefined) return null;
  if (Math.abs(surprisePercent) < 0.5) return "inline";
  return surprisePercent > 0 ? "beat" : "miss";
}

/** Revenue in the reporting currency, e.g. 64.6B or 950M. */
export function formatCompactAmount(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${Math.round(value / 1e6)}M`;
  return value.toFixed(0);
}

export function getLatestReport(summary: EarningsSummary | null) {
  return summary?.history[0] ?? null;
}

/** Like toneClass, but results within ±0.5% of the estimate read as neutral. */
export function surpriseToneClass(surprisePercent: number | null | undefined) {
  return getOutcome(surprisePercent) === "inline" ? "text-text-muted" : toneClass(surprisePercent);
}
