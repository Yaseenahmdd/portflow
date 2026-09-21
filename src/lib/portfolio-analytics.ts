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

export interface ContributionAdjustedPerformance {
  adjustedChangeAed: number | null;
  returnPercent: number | null;
  estimatedContributionsAed: number;
  startDate: string | null;
  endDate: string | null;
  snapshotCount: number;
}

export interface PortfolioActivityPoint {
  snapshot: PortfolioSnapshot;
  investedChangeAed: number | null;
  marketChangeAed: number | null;
  marketReturnPercent: number | null;
}

function getDateValue(snapshotDate: string) {
  return new Date(`${snapshotDate}T00:00:00Z`).getTime();
}

function getRangeStartDate(range: HistoryRange, endDate: Date) {
  const startDate = new Date(endDate);

  const subtractMonths = (months: number) => {
    const dayOfMonth = startDate.getUTCDate();
    startDate.setUTCDate(1);
    startDate.setUTCMonth(startDate.getUTCMonth() - months);
    const lastDayOfMonth = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0)
    ).getUTCDate();
    startDate.setUTCDate(Math.min(dayOfMonth, lastDayOfMonth));
    return startDate;
  };

  switch (range) {
    case "1W":
      startDate.setUTCDate(startDate.getUTCDate() - 7);
      return startDate;
    case "1M":
      return subtractMonths(1);
    case "3M":
      return subtractMonths(3);
    case "YTD":
      // A Dec 31 closing snapshot is the opening value for Jan 1 performance.
      return new Date(Date.UTC(endDate.getUTCFullYear() - 1, 11, 31));
    case "1Y": {
      const month = startDate.getUTCMonth();
      const dayOfMonth = startDate.getUTCDate();
      startDate.setUTCDate(1);
      startDate.setUTCFullYear(startDate.getUTCFullYear() - 1);
      startDate.setUTCMonth(month);
      const lastDayOfMonth = new Date(
        Date.UTC(startDate.getUTCFullYear(), month + 1, 0)
      ).getUTCDate();
      startDate.setUTCDate(Math.min(dayOfMonth, lastDayOfMonth));
      return startDate;
    }
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

  const latestDate = new Date(`${latestSnapshot.snapshotDate}T00:00:00Z`);
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

function getDubaiDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function getOvernightTotalReturnChange(
  snapshots: PortfolioSnapshot[],
  currentTotalReturnAed: number,
  now = new Date()
) {
  const todayDate = getDubaiDateKey(now);
  const yesterdayDate = getDubaiDateKey(
    new Date(
      new Date(`${todayDate}T00:00:00.000Z`).getTime() - 24 * 60 * 60 * 1000
    )
  );
  const yesterdaySnapshot = snapshots.find(
    (snapshot) => snapshot.snapshotDate === yesterdayDate
  );

  if (
    !yesterdaySnapshot ||
    !Number.isFinite(currentTotalReturnAed) ||
    !Number.isFinite(yesterdaySnapshot.totalGainLossAed)
  ) {
    return {
      changeAed: null,
      changePercent: null,
      baselineDate: yesterdayDate,
    };
  }

  const changeAed = currentTotalReturnAed - yesterdaySnapshot.totalGainLossAed;
  const changePercent =
    yesterdaySnapshot.totalValueAed > 0
      ? (changeAed / yesterdaySnapshot.totalValueAed) * 100
      : null;

  return {
    changeAed,
    changePercent:
      changePercent !== null && Number.isFinite(changePercent)
        ? changePercent
        : null,
    baselineDate: yesterdayDate,
  };
}

export function getContributionAdjustedPerformance(
  snapshots: PortfolioSnapshot[],
  includeOpeningGain = false
): ContributionAdjustedPerformance {
  const sortedSnapshots = [...snapshots].sort((a, b) =>
    a.snapshotDate.localeCompare(b.snapshotDate)
  );
  const first = sortedSnapshots[0] ?? null;
  const latest = sortedSnapshots[sortedSnapshots.length - 1] ?? null;
  const estimatedContributionsAed =
    first && latest &&
    Number.isFinite(first.totalInvestedAed) &&
    Number.isFinite(latest.totalInvestedAed)
      ? latest.totalInvestedAed - first.totalInvestedAed
      : 0;
  const unavailableResult: ContributionAdjustedPerformance = {
    adjustedChangeAed: null,
    returnPercent: null,
    estimatedContributionsAed,
    startDate: first?.snapshotDate ?? null,
    endDate: latest?.snapshotDate ?? null,
    snapshotCount: sortedSnapshots.length,
  };

  if ((!includeOpeningGain && sortedSnapshots.length < 2) || !first || !latest) {
    return unavailableResult;
  }

  const hasInvalidSnapshot = sortedSnapshots.some(
    (snapshot) =>
      !Number.isFinite(snapshot.totalValueAed) ||
      !Number.isFinite(snapshot.totalInvestedAed)
  );

  if (
    hasInvalidSnapshot ||
    latest.totalInvestedAed <= 0 ||
    (!includeOpeningGain && first.totalValueAed <= 0)
  ) {
    return unavailableResult;
  }

  const openingGainAed = first.totalValueAed - first.totalInvestedAed;
  const closingGainAed = latest.totalValueAed - latest.totalInvestedAed;
  const adjustedChangeAed = includeOpeningGain
    ? closingGainAed
    : closingGainAed - openingGainAed;
  const returnPercent = (adjustedChangeAed / latest.totalInvestedAed) * 100;

  if (!Number.isFinite(adjustedChangeAed) || !Number.isFinite(returnPercent)) {
    return unavailableResult;
  }

  return {
    adjustedChangeAed,
    returnPercent,
    estimatedContributionsAed,
    startDate: first.snapshotDate,
    endDate: latest.snapshotDate,
    snapshotCount: sortedSnapshots.length,
  };
}

export function getPortfolioActivity(
  snapshots: PortfolioSnapshot[]
): PortfolioActivityPoint[] {
  const sortedSnapshots = [...snapshots].sort((a, b) =>
    a.snapshotDate.localeCompare(b.snapshotDate)
  );

  return sortedSnapshots.map((snapshot, index) => {
    const previous = sortedSnapshots[index - 1];

    if (!previous || previous.totalValueAed <= 0) {
      return {
        snapshot,
        investedChangeAed: null,
        marketChangeAed: null,
        marketReturnPercent: null,
      };
    }

    const investedChangeAed =
      snapshot.totalInvestedAed - previous.totalInvestedAed;
    const marketChangeAed =
      snapshot.totalValueAed -
      previous.totalValueAed -
      investedChangeAed;
    const capitalAtRiskAed = previous.totalValueAed + investedChangeAed;
    const marketReturnPercent =
      capitalAtRiskAed > 0 ? (marketChangeAed / capitalAtRiskAed) * 100 : Number.NaN;

    if (
      !Number.isFinite(investedChangeAed) ||
      !Number.isFinite(marketChangeAed) ||
      !Number.isFinite(marketReturnPercent)
    ) {
      return {
        snapshot,
        investedChangeAed: null,
        marketChangeAed: null,
        marketReturnPercent: null,
      };
    }

    return {
      snapshot,
      investedChangeAed,
      marketChangeAed,
      marketReturnPercent,
    };
  });
}

export function getBestAndWorstMarketMoves(
  activity: PortfolioActivityPoint[]
) {
  const validMoves = activity.filter(
    (
      point
    ): point is PortfolioActivityPoint & {
      marketChangeAed: number;
      marketReturnPercent: number;
    } =>
      point.marketChangeAed !== null &&
      point.marketReturnPercent !== null
  );

  if (!validMoves.length) {
    return { best: null, worst: null };
  }

  const sortedMoves = [...validMoves].sort(
    (a, b) => a.marketReturnPercent - b.marketReturnPercent
  );

  return {
    best: sortedMoves[sortedMoves.length - 1],
    worst: sortedMoves[0],
  };
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
  const moves = getBestAndWorstMarketMoves(getPortfolioActivity(snapshots));
  const toDailyMove = (move: typeof moves.best) =>
    move
      ? {
          snapshotDate: move.snapshot.snapshotDate,
          changeAed: move.marketChangeAed,
          changePercent: move.marketReturnPercent,
        }
      : null;

  return {
    best: toDailyMove(moves.best),
    worst: toDailyMove(moves.worst),
  };
}

export function getHistorySummary(snapshots: PortfolioSnapshot[]) {
  const sortedSnapshots = [...snapshots].sort((a, b) =>
    a.snapshotDate.localeCompare(b.snapshotDate)
  );
  const first = sortedSnapshots[0] ?? null;
  const latest = sortedSnapshots[sortedSnapshots.length - 1] ?? null;
  const performance = getContributionAdjustedPerformance(sortedSnapshots);
  const rangeChangeAed = performance.adjustedChangeAed ?? 0;
  const rangeReturnPercent = performance.returnPercent ?? 0;
  const investedChangeAed = first && latest ? latest.totalInvestedAed - first.totalInvestedAed : 0;
  const { best, worst } = getBestAndWorstDailyMoves(sortedSnapshots);

  return {
    first,
    latest,
    rangeChangeAed,
    rangeReturnPercent,
    investedChangeAed,
    maxDrawdownPercent: getMaxDrawdown(sortedSnapshots),
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
