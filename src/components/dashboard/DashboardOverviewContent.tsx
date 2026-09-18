"use client";

import { useMemo, useState } from "react";
import AllocationCharts from "@/components/AllocationCharts";
import PortfolioSummaryStrip from "@/components/PortfolioSummaryStrip";
import PortfolioTrendChart from "@/components/PortfolioTrendChart";
import CashAccountsCard from "@/components/dashboard/CashAccountsCard";
import DashboardRefreshNotices from "@/components/dashboard/DashboardRefreshNotices";
import { tap } from "@/lib/haptics";
import type { ComputedHolding } from "@/lib/constants";
import type { CashBalanceSummary } from "@/lib/cash-balances";
import type { RefreshFailure } from "@/lib/dashboard/refresh";
import {
  filterSnapshotsByRange,
  getContributionAdjustedPerformance,
  HISTORY_RANGES,
  type HistoryRange,
} from "@/lib/portfolio-analytics";
import type { PortfolioSnapshot } from "@/lib/portfolio-snapshots";

interface DashboardOverviewContentProps {
  holdings: ComputedHolding[];
  totalValue: number;
  totalInvested: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  todayChange: number | null;
  todayChangePercent: number | null;
  isAmountsVisible: boolean;
  snapshots: PortfolioSnapshot[];
  refreshError: string | null;
  refreshFailures: RefreshFailure[];
  cash: CashBalanceSummary;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDateSpan(snapshots: PortfolioSnapshot[]) {
  const first = snapshots[0];
  const latest = snapshots[snapshots.length - 1];

  if (!first || !latest) {
    return "No snapshots available";
  }

  if (first.snapshotDate === latest.snapshotDate) {
    return `${formatDate(first.snapshotDate)} · 1 snapshot available`;
  }

  return `${formatDate(first.snapshotDate)} – ${formatDate(latest.snapshotDate)}`;
}

export default function DashboardOverviewContent({
  holdings,
  totalValue,
  totalInvested,
  totalGainLoss,
  totalGainLossPercent,
  todayChange,
  todayChangePercent,
  isAmountsVisible,
  snapshots,
  refreshError,
  refreshFailures,
  cash,
}: DashboardOverviewContentProps) {
  const [selectedRange, setSelectedRange] = useState<HistoryRange>("1M");
  const filteredSnapshots = useMemo(
    () => filterSnapshotsByRange(snapshots, selectedRange),
    [selectedRange, snapshots]
  );
  const periodPerformance = useMemo(
    () => getContributionAdjustedPerformance(filteredSnapshots, selectedRange === "ALL"),
    [filteredSnapshots, selectedRange]
  );
  const trendChartData = useMemo(
    () =>
      filteredSnapshots.map((snapshot) => ({
        date: snapshot.snapshotDate,
        invested: snapshot.totalInvestedAed,
        value: snapshot.totalValueAed,
      })),
    [filteredSnapshots]
  );
  const periodLabel = selectedRange === "ALL" ? "All-time" : selectedRange;

  return (
    <>
      <PortfolioSummaryStrip
        holdingsCount={holdings.length}
        portfolioValue={totalValue}
        portfolioHistory={trendChartData}
        investedAmount={totalInvested}
        totalGainLoss={totalGainLoss}
        totalGainLossPercent={totalGainLossPercent}
        todayChange={todayChange}
        todayChangePercent={todayChangePercent}
        periodLabel={periodLabel}
        periodChange={periodPerformance.adjustedChangeAed}
        periodReturnPercent={periodPerformance.returnPercent}
        isAmountsVisible={isAmountsVisible}
      />

      <DashboardRefreshNotices refreshError={refreshError} refreshFailures={refreshFailures} />

      <CashAccountsCard
        cash={cash}
        portfolioValueAed={totalValue}
        isAmountsVisible={isAmountsVisible}
      />

      <PortfolioTrendChart
        chartData={trendChartData}
        isAmountsVisible={isAmountsVisible}
        subtitle={getDateSpan(filteredSnapshots)}
        minimumDataPoints={2}
        emptyMessage={`Not enough history for ${periodLabel}.`}
        includeOpeningGain={selectedRange === "ALL"}
        headerAction={
          <div
            className="flex w-full items-center gap-0.5 sm:w-auto"
            role="group"
            aria-label="Select performance period"
          >
            {HISTORY_RANGES.map((range) => {
              const active = selectedRange === range.label;

              return (
                <button
                  key={range.label}
                  type="button"
                  onClick={() => {
                    tap();
                    setSelectedRange(range.label);
                  }}
                  aria-pressed={active}
                  title={range.name}
                  className={`relative h-11 min-w-0 flex-1 px-1 text-[13px] font-medium transition sm:w-10 sm:flex-none ${
                    active
                      ? "text-text-primary after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-3.5 after:-translate-x-1/2 after:rounded-full after:bg-accent-violet"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {range.label === "ALL" ? "All" : range.label}
                </button>
              );
            })}
          </div>
        }
      />

      <AllocationCharts holdings={holdings} totalValue={totalValue} totalInvested={totalInvested} />
    </>
  );
}
