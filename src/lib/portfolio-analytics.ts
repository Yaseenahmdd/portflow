import type { ComputedHolding } from "@/lib/constants";
import type { PortfolioSnapshot } from "@/lib/portfolio-snapshots";

export type HistoryRange = "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

export const HISTORY_RANGES: Array<{ label: HistoryRange; name: string }> = [
  { label: "1W", name: "1 week" },
  { label: "1M", name: "1 month" },
  { label: "3M", name: "3 months" },
  { label: "YTD", name: "Year to date" },
  { label: "1Y", name: "1 year" },
  { label: "ALL", name: "All time" },
];

function getDateValue(snapshotDate: string) {
  return new Date(`${snapshotDate}T00:00:00`).getTime();
}

function getRangeStartDate(range: HistoryRange, endDate: Date) {
  const startDate = new Date(endDate);

  switch (range) {
    case "1W":
      startDate.setDate(startDate.getDate() - 7);
      return startDate;
    case "1M":
      startDate.setMonth(startDate.getMonth() - 1);
      return startDate;
    case "3M":
      startDate.setMonth(startDate.getMonth() - 3);
      return startDate;
    case "YTD":
      return new Date(endDate.getFullYear(), 0, 1);
    case "1Y":
      startDate.setFullYear(startDate.getFullYear() - 1);
      return startDate;
    case "ALL":
      return null;
  }
}

export function filterSnapshotsByRange(snapshots: PortfolioSnapshot[], range: HistoryRange) {
  const sortedSnapshots = [...snapshots].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
  const latestSnapshot = sortedSnapshots[sortedSnapshots.length - 1];

  if (!latestSnapshot || range === "ALL") {
    return sortedSnapshots;
  }

  const latestDate = new Date(`${latestSnapshot.snapshotDate}T00:00:00`);
  const startDate = getRangeStartDate(range, latestDate);
  if (!startDate) {
    return sortedSnapshots;
  }

  const startValue = startDate.getTime();
  return sortedSnapshots.filter((snapshot) => getDateValue(snapshot.snapshotDate) >= startValue);
}

export function getSnapshotReturn(startValue: number, endValue: number) {
  return startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
}

export function getMaxDrawdown(snapshots: PortfolioSnapshot[]) {
  let peak = 0;
  let maxDrawdown = 0;

  for (const snapshot of snapshots) {
    const value = snapshot.totalValueAed;
    peak = Math.max(peak, value);

    if (peak > 0) {
      maxDrawdown = Math.min(maxDrawdown, ((value - peak) / peak) * 100);
    }
  }

  return maxDrawdown;
}

export function getBestAndWorstDailyMoves(snapshots: PortfolioSnapshot[]) {
  let best: { snapshotDate: string; changeAed: number; changePercent: number } | null = null;
  let worst: { snapshotDate: string; changeAed: number; changePercent: number } | null = null;

  for (let index = 1; index < snapshots.length; index += 1) {
    const previous = snapshots[index - 1];
    const current = snapshots[index];
    const changeAed = current.totalValueAed - previous.totalValueAed;
    const changePercent = getSnapshotReturn(previous.totalValueAed, current.totalValueAed);
    const move = { snapshotDate: current.snapshotDate, changeAed, changePercent };

    if (!best || move.changePercent > best.changePercent) {
      best = move;
    }

    if (!worst || move.changePercent < worst.changePercent) {
      worst = move;
    }
  }

  return { best, worst };
}

export function getHistorySummary(snapshots: PortfolioSnapshot[]) {
  const first = snapshots[0] ?? null;
  const latest = snapshots[snapshots.length - 1] ?? null;
  const rangeChangeAed = first && latest ? latest.totalValueAed - first.totalValueAed : 0;
  const rangeReturnPercent = first && latest ? getSnapshotReturn(first.totalValueAed, latest.totalValueAed) : 0;
  const investedChangeAed = first && latest ? latest.totalInvestedAed - first.totalInvestedAed : 0;
  const { best, worst } = getBestAndWorstDailyMoves(snapshots);

  return {
    first,
    latest,
    rangeChangeAed,
    rangeReturnPercent,
    investedChangeAed,
    maxDrawdownPercent: getMaxDrawdown(snapshots),
    bestDailyMove: best,
    worstDailyMove: worst,
  };
}

export function getTopHoldingContributors(holdings: ComputedHolding[]) {
  const sorted = [...holdings].sort((a, b) => b.gainLossAed - a.gainLossAed);

  return {
    best: sorted[0] ?? null,
    worst: sorted[sorted.length - 1] ?? null,
  };
}
