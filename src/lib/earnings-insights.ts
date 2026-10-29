import type {
  EarningsDetails,
  EarningsSummary,
  EpsEstimate,
  ReportedQuarter,
} from "@/lib/api/nasdaq-earnings";
import { formatEps, getSurpriseStreak } from "@/lib/earnings";

export type InsightTone = "positive" | "negative" | "watch";

export interface EarningsInsight {
  tone: InsightTone;
  text: string;
}

function percentChange(current: number, previous: number) {
  return previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100;
}

function formatPercent(value: number) {
  return `${Math.abs(value) >= 10 ? Math.round(Math.abs(value)) : Math.abs(value).toFixed(1)}%`;
}

function signedPercent(value: number) {
  return `${value >= 0 ? "+" : "-"}${formatPercent(value)}`;
}

function daysBetween(a: string, b: string) {
  return (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/** Year-over-year revenue growth for the quarter ending `periodEnd`. */
export function getRevenueGrowth(reported: ReportedQuarter[], periodEnd: string) {
  const current = reported.find((quarter) => quarter.periodEnd === periodEnd);
  const yearAgo = reported.find((quarter) => {
    const gap = daysBetween(periodEnd, quarter.periodEnd);
    return gap > 330 && gap < 400;
  });
  if (current?.revenueMillions == null || yearAgo?.revenueMillions == null) return null;
  return percentChange(current.revenueMillions, yearAgo.revenueMillions);
}

/** The estimate row for the quarter being reported next. */
export function getUpcomingEstimate(summary: EarningsSummary | null, details: EarningsDetails | null): EpsEstimate | null {
  const estimates = details?.quarterlyEstimates ?? [];
  const fiscalQuarter = summary?.upcoming?.fiscalQuarter;
  return (fiscalQuarter && estimates.find((row) => row.fiscalPeriod === fiscalQuarter)) || estimates[0] || null;
}

function expectationInsight(consensus: number | null, lastYear: number | null): EarningsInsight | null {
  if (consensus === null) return null;
  if (lastYear === null) {
    return { tone: "watch", text: `Analysts expect EPS of ${formatEps(consensus)} this quarter.` };
  }
  if (consensus < 0 && lastYear > 0) {
    return { tone: "negative", text: `Analysts expect a swing to a loss: ${formatEps(consensus)} vs ${formatEps(lastYear)} a year ago.` };
  }
  if (consensus < 0) {
    return {
      tone: consensus > lastYear ? "watch" : "negative",
      text: `Analysts expect a loss of ${formatEps(Math.abs(consensus))} per share (a year ago: ${formatEps(lastYear)}). Watch whether losses are ${consensus > lastYear ? "narrowing" : "widening"}.`,
    };
  }
  if (lastYear <= 0) {
    return { tone: "positive", text: `Analysts expect a swing to profit: ${formatEps(consensus)} vs ${formatEps(lastYear)} a year ago.` };
  }
  const change = percentChange(consensus, lastYear)!;
  if (change <= -10) {
    return {
      tone: "watch",
      text: `The bar is low: consensus ${formatEps(consensus)} is ${formatPercent(change)} below the ${formatEps(lastYear)} reported a year ago.${change <= -50 ? " Check whether last year included one-off gains." : ""}`,
    };
  }
  if (change >= 10) {
    return { tone: "watch", text: `Analysts expect ${formatPercent(change)} EPS growth: ${formatEps(consensus)} vs ${formatEps(lastYear)} a year ago.` };
  }
  return { tone: "watch", text: `Analysts expect EPS roughly flat with last year: ${formatEps(consensus)} vs ${formatEps(lastYear)}.` };
}

function revisionInsight(estimate: EpsEstimate | null, details: EarningsDetails | null): EarningsInsight | null {
  const up = estimate?.revisionsUp ?? 0;
  const down = estimate?.revisionsDown ?? 0;
  const now = details?.momentum?.quarterNow ?? null;
  const monthAgo = details?.momentum?.quarterMonthAgo ?? null;
  const drift = now !== null && monthAgo !== null ? percentChange(now, monthAgo) : null;
  const driftText =
    drift !== null && Math.abs(drift) >= 2 ? ` Consensus moved from ${formatEps(monthAgo)} to ${formatEps(now)} over the past month.` : "";
  if (down > up) {
    return { tone: "negative", text: `Estimates are being cut: ${down} down, ${up} up in the last 4 weeks.${driftText}` };
  }
  if (up > down) {
    return { tone: "positive", text: `Estimates are rising: ${up} up, ${down} down in the last 4 weeks.${driftText}` };
  }
  if (driftText) return { tone: drift! > 0 ? "positive" : "negative", text: driftText.trim() };
  return null;
}

function trackRecordInsight(summary: EarningsSummary | null): EarningsInsight | null {
  const surprises = (summary?.history ?? [])
    .slice(0, 4)
    .map((result) => result.surprisePercent)
    .filter((value): value is number => value !== null);
  if (!surprises.length) return null;
  const streak = getSurpriseStreak(summary);
  const beats = surprises.filter((value) => value > 0).length;
  if (streak >= 3) {
    return { tone: "positive", text: `Beat estimates ${streak} quarters running, so the market may already expect another beat.` };
  }
  if (streak <= -2) {
    return { tone: "negative", text: `Missed estimates ${-streak} quarters running. Another miss would extend the pattern.` };
  }
  if (surprises.length >= 2 && beats === 0) {
    return { tone: "negative", text: `Missed estimates in all of the last ${surprises.length} reported quarters.` };
  }
  if (surprises.length >= 2 && beats === surprises.length) {
    return { tone: "positive", text: `Beat estimates in all of the last ${surprises.length} reported quarters.` };
  }
  return { tone: "watch", text: `Mixed record: beat estimates in ${beats} of the last ${surprises.length} quarters.` };
}

function revenueInsight(details: EarningsDetails | null): EarningsInsight | null {
  const reported = details?.reported ?? [];
  const [latest, previous] = reported;
  if (!latest) return null;
  const latestGrowth = getRevenueGrowth(reported, latest.periodEnd);
  if (latestGrowth === null) return null;
  const previousGrowth = previous ? getRevenueGrowth(reported, previous.periodEnd) : null;
  const growthText = signedPercent(latestGrowth);
  if (latestGrowth < 0) {
    return { tone: "negative", text: `Revenue fell ${formatPercent(latestGrowth)} year over year last quarter. Watch for signs of a bottom.` };
  }
  if (previousGrowth !== null && latestGrowth < previousGrowth - 3) {
    return {
      tone: "watch",
      text: `Revenue growth is slowing: ${growthText} year over year last quarter, down from ${signedPercent(previousGrowth)}. Watch whether it keeps decelerating.`,
    };
  }
  if (previousGrowth !== null && latestGrowth > previousGrowth + 3) {
    return {
      tone: "positive",
      text: `Revenue growth is speeding up: ${growthText} year over year last quarter, up from ${signedPercent(previousGrowth)}.`,
    };
  }
  return { tone: "watch", text: `Revenue grew ${growthText} year over year last quarter. Watch whether that pace holds.` };
}

function revenueSurpriseInsight(summary: EarningsSummary | null): EarningsInsight | null {
  const latest = summary?.history[0];
  const surprise = latest?.revenueSurprisePercent;
  if (surprise == null) return null;
  if (Math.abs(surprise) < 0.5) {
    return { tone: "watch", text: `Revenue came in line with estimates last quarter (${signedPercent(surprise)}).` };
  }
  return surprise > 0
    ? { tone: "positive", text: `Revenue beat estimates by ${formatPercent(surprise)} last quarter. Watch whether the top line keeps outrunning forecasts.` }
    : { tone: "negative", text: `Revenue missed estimates by ${formatPercent(surprise)} last quarter. Another revenue miss would matter more than an EPS beat.` };
}

function guidanceInsight(summary: EarningsSummary | null): EarningsInsight | null {
  const latest = summary?.history[0];
  const direction = latest?.guidance?.direction;
  if (direction === "raised") {
    return { tone: "positive", text: "Guidance was raised last quarter. A second raise would confirm the momentum; a hold could disappoint." };
  }
  if (direction === "lowered") {
    return { tone: "negative", text: "Guidance was cut last quarter. Listen for whether the outlook stabilises or gets cut again." };
  }
  if (direction === "reaffirmed") {
    return { tone: "watch", text: "Guidance was reaffirmed last quarter. Any change this time will likely drive the stock." };
  }
  const spending = latest?.spendingOutlook?.direction;
  if (spending === "raised") {
    return { tone: "watch", text: "The spending outlook was raised last quarter. Watch margins and free cash flow, not just revenue." };
  }
  if (spending === "lowered") {
    return { tone: "positive", text: "The spending outlook was cut last quarter. Watch whether margins improve as a result." };
  }
  const change = latest?.estimateChangePercent;
  if (change != null && Math.abs(change) >= 2) {
    return {
      tone: change > 0 ? "positive" : "negative",
      text: `Analysts ${change > 0 ? "raised" : "cut"} full-year EPS estimates ${formatPercent(change)} after the last report.`,
    };
  }
  return null;
}

function fullYearInsight(details: EarningsDetails | null): EarningsInsight | null {
  const year = details?.yearlyEstimates[0];
  if (!year) return null;
  const up = year.revisionsUp ?? 0;
  const down = year.revisionsDown ?? 0;
  if (down >= 2 && down > up) {
    return { tone: "negative", text: `Full-year (${year.fiscalPeriod}) estimates were cut ${down} times in 4 weeks. Listen for whether guidance holds.` };
  }
  if (up >= 2 && up > down) {
    return { tone: "positive", text: `Full-year (${year.fiscalPeriod}) estimates were raised ${up} times in 4 weeks. Guidance may be raised too.` };
  }
  return null;
}

function dispersionInsight(estimate: EpsEstimate | null): EarningsInsight | null {
  if (!estimate || estimate.consensus === null) return null;
  const analysts = estimate.analysts ?? 0;
  if (analysts > 0 && analysts <= 2) {
    return { tone: "watch", text: `Only ${analysts} analyst${analysts === 1 ? "" : "s"} cover${analysts === 1 ? "s" : ""} this quarter, so the consensus is thin.` };
  }
  if (estimate.high === null || estimate.low === null) return null;
  const spread = (estimate.high - estimate.low) / Math.max(Math.abs(estimate.consensus), 0.01);
  if (spread >= 0.4) {
    return {
      tone: "watch",
      text: `Analysts disagree: estimates range from ${formatEps(estimate.low)} to ${formatEps(estimate.high)}, so a big surprise either way is possible.`,
    };
  }
  return null;
}

function analystInsight(details: EarningsDetails | null, price: number | null): EarningsInsight | null {
  const view = details?.analysts;
  if (!view || view.targetMean === null || !price) return null;
  const upside = percentChange(view.targetMean, price)!;
  const mix = `${view.buy} buy, ${view.hold} hold, ${view.sell} sell`;
  return {
    tone: upside >= 15 ? "positive" : upside < 0 ? "negative" : "watch",
    text: `Average price target $${view.targetMean.toFixed(2)} is ${formatPercent(upside)} ${upside >= 0 ? "above" : "below"} today's $${price.toFixed(2)} (${mix}).`,
  };
}

export function buildEarningsInsights(
  summary: EarningsSummary | null,
  details: EarningsDetails | null,
  price: number | null
): EarningsInsight[] {
  const estimate = getUpcomingEstimate(summary, details);
  const consensus = summary?.upcoming?.consensusEps ?? estimate?.consensus ?? null;
  const lastYear = summary?.upcoming?.lastYearEps ?? null;

  return [
    expectationInsight(consensus, lastYear),
    revisionInsight(estimate, details),
    trackRecordInsight(summary),
    revenueSurpriseInsight(summary),
    guidanceInsight(summary),
    revenueInsight(details),
    fullYearInsight(details),
    dispersionInsight(estimate),
    analystInsight(details, price),
  ].filter((insight): insight is EarningsInsight => insight !== null);
}
