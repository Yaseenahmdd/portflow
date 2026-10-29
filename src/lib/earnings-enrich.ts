import type { QuarterRevenueEstimate } from "@/lib/api/alphavantage-estimates";
import type { FinnhubEarningsEntry } from "@/lib/api/finnhub";
import type { EarningsSummary, GuidanceDirection, GuidanceSignal, ReportedQuarter } from "@/lib/api/nasdaq-earnings";
import type { Headline } from "@/lib/api/yahoo-news";

const REPORT_MATCH_DAYS = 3;
const UPCOMING_MATCH_DAYS = 7;
const PROJECTED_MATCH_DAYS = 30;
// Headlines from the day before a report to a few days after it.
const GUIDANCE_WINDOW_BEFORE_DAYS = 1;
const GUIDANCE_WINDOW_AFTER_DAYS = 4;

function dayGap(a: string, b: string) {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

function closest(entries: FinnhubEarningsEntry[], date: string, maxDays: number) {
  let best: FinnhubEarningsEntry | null = null;
  for (const entry of entries) {
    const gap = dayGap(entry.date, date);
    if (gap <= maxDays && (!best || gap < dayGap(best.date, date))) best = entry;
  }
  return best;
}

export function getRevenueSurprise(estimate: number | null | undefined, actual: number | null | undefined) {
  if (estimate == null || actual == null || estimate === 0) return null;
  return ((actual - estimate) / Math.abs(estimate)) * 100;
}

/** Adds revenue estimates/actuals (and report timing when missing) from Finnhub. */
export function applyFinnhubRevenue(summary: EarningsSummary, entries: FinnhubEarningsEntry[]): EarningsSummary {
  if (!entries.length) return summary;
  const history = summary.history.map((result) => {
    const entry = closest(entries, result.reportedDate, REPORT_MATCH_DAYS);
    if (!entry || (entry.revenueEstimate === null && entry.revenueActual === null)) return result;
    return {
      ...result,
      revenueEstimate: entry.revenueEstimate,
      revenueActual: entry.revenueActual,
      revenueSurprisePercent: getRevenueSurprise(entry.revenueEstimate, entry.revenueActual),
    };
  });

  let upcoming = summary.upcoming;
  if (upcoming?.status === "projected") {
    // Our projection is a quarter after the last report; Finnhub's date is a better guess.
    const entry = closest(entries, upcoming.date, PROJECTED_MATCH_DAYS);
    if (entry && entry.revenueActual === null && entry.epsActual === null) {
      upcoming = { ...upcoming, date: entry.date, status: "estimated" };
    }
  }
  if (upcoming) {
    const entry = closest(entries, upcoming.date, UPCOMING_MATCH_DAYS);
    if (entry && entry.revenueActual === null) {
      upcoming = {
        ...upcoming,
        revenueEstimate: entry.revenueEstimate ?? upcoming.revenueEstimate,
        timing: upcoming.timing ?? entry.timing,
      };
    }
  }
  return { ...summary, history, upcoming };
}

const GUIDANCE_NOUN = "(?:guidance|outlook|forecasts?|full-year view|annual view)";
const GUIDANCE_PATTERNS: Array<{ direction: GuidanceDirection; pattern: RegExp }> = [
  {
    direction: "lowered",
    pattern: new RegExp(`\\b(?:cuts?|lowers?|lowered|slash(?:es|ed)?|trims?|trimmed|reduces?|reduced|withdraws?|withdrew|pulls?)\\b[^.]{0,40}\\b${GUIDANCE_NOUN}`, "i"),
  },
  {
    direction: "lowered",
    pattern: new RegExp(`\\b(?:weak|soft|downbeat|gloomy|disappointing|bleak|cautious|lower|below-estimate)\\s+(?:[\\w-]+\\s+){0,2}${GUIDANCE_NOUN}`, "i"),
  },
  {
    direction: "lowered",
    pattern: new RegExp(`\\b${GUIDANCE_NOUN}\\b[^.]{0,25}\\b(?:cut|lowered|below|misses|disappoints|falls short)\\b`, "i"),
  },
  {
    direction: "raised",
    pattern: new RegExp(`\\b(?:raises?|raised|raising|hikes?|hiked|lifts?|lifted|boosts?|boosted|ups|upped|increases?|increased)\\b[^.]{0,40}\\b${GUIDANCE_NOUN}`, "i"),
  },
  {
    direction: "raised",
    pattern: new RegExp(`\\b(?:upbeat|strong|rosy|bullish|robust|higher|better-than-expected|above-estimate)\\s+(?:[\\w-]+\\s+){0,2}${GUIDANCE_NOUN}`, "i"),
  },
  {
    direction: "raised",
    pattern: new RegExp(`\\b${GUIDANCE_NOUN}\\b[^.]{0,25}\\b(?:raised|tops|beats|above)\\b`, "i"),
  },
  {
    direction: "reaffirmed",
    pattern: new RegExp(`\\b(?:reaffirms?|reaffirmed|reiterates?|reiterated|maintains?|maintained|confirms?|confirmed|keeps?|kept)\\b[^.]{0,40}\\b${GUIDANCE_NOUN}`, "i"),
  },
];

// Capex and cost plans. A higher spending outlook is not a raised forecast, so
// these headlines are classified first and reported separately.
const SPENDING_WORD = "(?:spend(?:ing)?|capex|capital expenditures?|capital spending|investments?|expenses?|costs?)";
const SPENDING_OUTLOOK = new RegExp(
  `\\b${SPENDING_WORD}\\s+(?:[\\w-]+\\s+)?(?:${GUIDANCE_NOUN}|plans?|budgets?)\\b|\\b${GUIDANCE_NOUN}\\s+for\\s+(?:[\\w-]+\\s+){0,2}${SPENDING_WORD}\\b`,
  "i"
);
const SPENDING_UP = /\b(?:raises?|raised|hikes?|hiked|lifts?|lifted|boosts?|boosted|increases?|increased|higher|bigger|ramps?|ramped|surging|soaring)\b/i;
const SPENDING_DOWN = /\b(?:cuts?|lowers?|lowered|reduces?|reduced|trims?|trimmed|smaller|slash(?:es|ed)?|scales? back)\b/i;

export type OutlookKind = "guidance" | "spending";

/** What a headline says about the outlook, if anything. */
// Questions are speculation, and analyst headlines describe the Street's
// forecasts rather than the company's own.
const SPECULATIVE = /\?\s*$|^(?:will|could|should|can|is|are|does|do|what|how|why|when)\b/i;
const ABOUT_ANALYSTS = /\b(?:analysts?|price targets?|brokerage|downgrades?|upgrades?)\b/i;

export function classifyOutlookHeadline(title: string): { kind: OutlookKind; direction: GuidanceDirection } | null {
  if (SPECULATIVE.test(title.trim()) || ABOUT_ANALYSTS.test(title)) return null;
  const spending = SPENDING_OUTLOOK.exec(title);
  if (spending) {
    const direction = nearestSpendingDirection(title, spending.index, spending.index + spending[0].length);
    return direction ? { kind: "spending", direction } : null;
  }
  const match = GUIDANCE_PATTERNS.find(({ pattern }) => pattern.test(title));
  return match ? { kind: "guidance", direction: match.direction } : null;
}

const SPENDING_DIRECTION_REACH = 40;

/** The up/down word closest to the spending phrase, so "Shares Move Lower" elsewhere doesn't count. */
function nearestSpendingDirection(title: string, start: number, end: number): GuidanceDirection | null {
  let best: { direction: GuidanceDirection; distance: number } | null = null;
  const candidates: Array<[GuidanceDirection, RegExp]> = [
    ["raised", SPENDING_UP],
    ["lowered", SPENDING_DOWN],
  ];
  for (const [direction, pattern] of candidates) {
    for (const match of title.matchAll(new RegExp(pattern.source, "gi"))) {
      const matchStart = match.index ?? 0;
      const matchEnd = matchStart + match[0].length;
      const distance = matchEnd <= start ? start - matchEnd : matchStart >= end ? matchStart - end : 0;
      if (distance <= SPENDING_DIRECTION_REACH && (!best || distance < best.distance)) best = { direction, distance };
    }
  }
  return best?.direction ?? null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Words that identify the company in a headline: its ticker and short name. */
export function getCompanyTokens(symbol: string, companyName?: string) {
  const tokens = [symbol.toUpperCase()];
  const words = (companyName ?? "").replace(/[,()]/g, " ").split(/\s+/).filter(Boolean);
  if (words[0]) {
    // "Li Auto" rather than "Li": very short first words need a second word to be distinctive.
    tokens.push(words[0].length < 3 && words[1] ? `${words[0]} ${words[1]}` : words[0]);
    if (/\.com$/i.test(words[0])) tokens.push(words[0].replace(/\.com$/i, ""));
  }
  return [...new Set(tokens.filter((token) => token.length >= 2))];
}

function mentionsCompany(title: string, tokens: string[]) {
  return tokens.some((token) => new RegExp(`(^|[^A-Za-z])${escapeRegex(token)}([^A-Za-z]|$)`, token === token.toUpperCase() ? "" : "i").test(title));
}

/**
 * Market wrap headlines cover several companies ("Apple dives on weak
 * forecast; Amazon surges"), so the outlook phrase must sit in the same
 * clause as the company's name.
 */
// A clause that opens with a verb ("...; Issues strong outlook") continues the
// previous clause's subject instead of naming a new company.
const VERB_START = /^\s*(?:issues?|raises?|lifts?|hikes?|boosts?|ups|cuts?|lowers?|trims?|slashes|withdraws?|sees?|guides?|forecasts?|expects?|projects?|reaffirms?|reiterates?|maintains?|offers?|gives?|provides?)\b/i;

// ...or that opens with the outlook itself ("...; CapEx outlook raised").
const OUTLOOK_START = /^\s*(?:(?:Q[1-4]|[\w-]+-quarter|full-year|annual|20\d\d)\s+)?(?:capex|capital|spending|revenue|sales|profit|earnings|ebitda|bookings|margins?|guidance|outlook|forecasts?)\b/i;

function classifyAboutCompany(title: string, tokens: string[]) {
  if (SPECULATIVE.test(title.trim()) || ABOUT_ANALYSTS.test(title)) return null;
  let subjectIsCompany = false;
  for (const clause of title.split(/;|\s+but\s+/i)) {
    subjectIsCompany = mentionsCompany(clause, tokens) || (subjectIsCompany && (VERB_START.test(clause) || OUTLOOK_START.test(clause)));
    if (!subjectIsCompany) continue;
    const signal = classifyOutlookHeadline(clause);
    if (signal) return signal;
  }
  return null;
}

function pickSignal(matches: GuidanceSignal[]) {
  if (!matches.length) return null;
  const counts = new Map<GuidanceDirection, number>();
  for (const match of matches) counts.set(match.direction, (counts.get(match.direction) ?? 0) + 1);
  const top = Math.max(...counts.values());
  // Headlines are sorted newest first, so the first match of a top direction is the latest.
  return matches.find((match) => counts.get(match.direction) === top) ?? null;
}

/**
 * Looks for outlook headlines about the company around a report, split into
 * revenue/profit guidance and spending plans. Conflicting signals resolve to
 * the most common direction, then the most recent headline.
 */
export function detectOutlook(headlines: Headline[], reportDate: string, tokens: string[]) {
  const start = Date.parse(`${reportDate}T00:00:00Z`) - GUIDANCE_WINDOW_BEFORE_DAYS * 86_400_000;
  const end = Date.parse(`${reportDate}T00:00:00Z`) + (GUIDANCE_WINDOW_AFTER_DAYS + 1) * 86_400_000;
  const found: Record<OutlookKind, GuidanceSignal[]> = { guidance: [], spending: [] };
  const seen = new Set<string>();

  const sorted = [...headlines].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  for (const headline of sorted) {
    const published = headline.publishedAt ? Date.parse(headline.publishedAt) : NaN;
    if (!Number.isFinite(published) || published < start || published >= end) continue;
    // The same story often arrives from both feeds.
    const key = headline.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const signal = classifyAboutCompany(headline.title, tokens);
    if (signal) found[signal.kind].push({ direction: signal.direction, headline: headline.title, url: headline.url });
  }
  return { guidance: pickSignal(found.guidance), spending: pickSignal(found.spending) };
}

export function detectGuidance(headlines: Headline[], reportDate: string, tokens: string[]): GuidanceSignal | null {
  return detectOutlook(headlines, reportDate, tokens).guidance;
}

/** Applies outlook detection to every report the headlines can cover. */
export function applyGuidance(summary: EarningsSummary, headlines: Headline[], tokens: string[]): EarningsSummary {
  if (!headlines.length) return summary;
  return {
    ...summary,
    history: summary.history.map((result) => {
      const { guidance, spending } = detectOutlook(headlines, result.reportedDate, tokens);
      return {
        ...result,
        ...(guidance ? { guidance } : {}),
        ...(spending ? { spendingOutlook: spending } : {}),
      };
    }),
  };
}

export interface EstimatePoint {
  asOfDate: string;
  consensus: number | null;
}

/**
 * How the full-year EPS consensus moved because of a report: the last
 * reading before the report vs the latest one at least a day after it.
 */
export function getEstimateChange(points: EstimatePoint[], reportDate: string) {
  const sorted = [...points].filter((point) => point.consensus !== null).sort((a, b) => a.asOfDate.localeCompare(b.asOfDate));
  const before = [...sorted].reverse().find((point) => point.asOfDate < reportDate);
  const after = [...sorted].reverse().find((point) => dayGap(point.asOfDate, reportDate) >= 1 && point.asOfDate > reportDate);
  if (!before || !after || !before.consensus) return null;
  return ((after.consensus! - before.consensus) / Math.abs(before.consensus)) * 100;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 2026" ↔ a period ending 2026-09-xx. */
export function matchesFiscalQuarter(fiscalQuarter: string, periodEnd: string) {
  const [month, year] = fiscalQuarter.split(" ");
  const monthIndex = MONTHS.indexOf(month);
  return monthIndex !== -1 && periodEnd.startsWith(`${year}-${String(monthIndex + 1).padStart(2, "0")}`);
}

/** Reported revenue for a quarter from Nasdaq's revenue table, in currency units. */
export function getReportedRevenue(reported: ReportedQuarter[], fiscalQuarter: string) {
  const quarter = reported.find((item) => matchesFiscalQuarter(fiscalQuarter, item.periodEnd));
  return quarter?.revenueMillions != null ? quarter.revenueMillions * 1e6 : null;
}

/**
 * Fills revenue beat/miss for reports Finnhub no longer covers: the final
 * consensus (Alpha Vantage) against the reported figure (Nasdaq).
 */
export function applyHistoricalRevenue(
  summary: EarningsSummary,
  estimates: QuarterRevenueEstimate[],
  reported: ReportedQuarter[]
): EarningsSummary {
  if (!estimates.length || !reported.length) return summary;
  return {
    ...summary,
    history: summary.history.map((result) => {
      if (result.revenueSurprisePercent != null) return result;
      const estimate = estimates.find((item) => matchesFiscalQuarter(result.fiscalQuarter, item.periodEnd))?.revenueEstimate ?? null;
      const actual = getReportedRevenue(reported, result.fiscalQuarter);
      const surprise = getRevenueSurprise(estimate, actual);
      return surprise === null ? result : { ...result, revenueEstimate: estimate, revenueActual: actual, revenueSurprisePercent: surprise };
    }),
  };
}
