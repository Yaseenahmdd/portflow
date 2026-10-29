import { fetchYahooCloseHistory } from "@/lib/api/historical-prices";
import type { EarningsSummary, PriceReaction } from "@/lib/api/nasdaq-earnings";
import type { HistoricalPricePoint } from "@/lib/historical-portfolio";

const LOOKBACK_PADDING_DAYS = 10;

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/**
 * Past reports don't say whether they came before the open or after the
 * close, so measure from the last close before the report date to the first
 * close after it. That window holds the reaction either way.
 */
export function getPriceReaction(points: HistoricalPricePoint[], reportedDate: string): PriceReaction | null {
  let before: HistoricalPricePoint | null = null;
  let after: HistoricalPricePoint | null = null;
  for (const point of points) {
    if (point.date < reportedDate) before = point;
    else if (point.date > reportedDate) {
      after = point;
      break;
    }
  }
  if (!before || !after || before.price <= 0) return null;
  return {
    beforeDate: before.date,
    afterDate: after.date,
    changePercent: ((after.price - before.price) / before.price) * 100,
  };
}

export async function attachPriceReactions(summaries: Record<string, EarningsSummary>, today: string) {
  await Promise.all(
    Object.values(summaries).map(async (summary) => {
      const oldest = summary.history[summary.history.length - 1]?.reportedDate;
      if (!oldest) return;
      try {
        const points = await fetchYahooCloseHistory(summary.symbol, addDays(oldest, -LOOKBACK_PADDING_DAYS), today);
        summary.history = summary.history.map((result) => ({
          ...result,
          priceReaction: getPriceReaction(points, result.reportedDate),
        }));
      } catch (error) {
        console.error(`Earnings reactions: failed to fetch prices for ${summary.symbol}:`, error);
      }
    })
  );
  return summaries;
}
