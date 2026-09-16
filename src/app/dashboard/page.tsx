"use client";

import { useEffect, useMemo } from "react";
import DashboardOverviewContent from "@/components/dashboard/DashboardOverviewContent";
import DashboardPullToRefreshIndicator from "@/components/dashboard/DashboardPullToRefreshIndicator";
import { useDashboardStateContext } from "@/components/dashboard/DashboardStateProvider";
import { timeAgo } from "@/lib/utils";

export default function DashboardPage() {
  const {
    mounted,
    inrToAedRate,
    fxUpdatedAt,
    isAmountsVisible,
    isRefreshing,
    isPullRefreshing,
    pullDistance,
    refreshFailures,
    refreshError,
    computedHoldings,
    summary,
    snapshots,
  } = useDashboardStateContext();

  const latestRefreshAt = useMemo(() => {
    const timestamps = computedHoldings
      .map((holding) => holding.lastPriceUpdate)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value));

    if (!timestamps.length) {
      return null;
    }

    return new Date(Math.max(...timestamps)).toISOString();
  }, [computedHoldings]);
  const todayPerformance = useMemo(() => {
    const reportingHoldings = computedHoldings.filter((holding) => holding.hasDayGain);

    if (!reportingHoldings.length) {
      return {
        changeAed: null,
        changePercent: null,
      };
    }

    const changeAed = reportingHoldings.reduce(
      (sum, holding) => sum + holding.dayGainAed,
      0
    );
    const previousPortfolioValue = reportingHoldings.reduce(
      (sum, holding) => sum + holding.currentValueAed - holding.dayGainAed,
      0
    );

    return {
      changeAed,
      changePercent:
        previousPortfolioValue > 0
          ? (changeAed / previousPortfolioValue) * 100
          : null,
    };
  }, [computedHoldings]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("portflow:status-meta", {
        detail: {
          lastRefresh: isRefreshing ? "Refreshing..." : `Last refresh ${latestRefreshAt ? timeAgo(latestRefreshAt) : "not yet available"}`,
          fxRate: (inrToAedRate ? 1 / inrToAedRate : 0).toFixed(2),
          fxUpdatedAt: `FX ${fxUpdatedAt ? timeAgo(fxUpdatedAt) : "not yet available"}`,
        },
      })
    );

    return () => {
      window.dispatchEvent(new CustomEvent("portflow:status-meta", { detail: null }));
    };
  }, [fxUpdatedAt, inrToAedRate, isRefreshing, latestRefreshAt]);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-56" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-[22rem] rounded-2xl" />
        <div className="grid gap-4 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="skeleton h-72 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardPullToRefreshIndicator
        pullDistance={pullDistance}
        isPullRefreshing={isPullRefreshing}
        isRefreshing={isRefreshing}
      />

      <div className="space-y-4 sm:space-y-6">
        <DashboardOverviewContent
          holdings={computedHoldings}
          totalValue={summary.totalValue}
          totalInvested={summary.totalInvested}
          totalGainLoss={summary.totalGainLoss}
          totalGainLossPercent={summary.totalGainLossPct}
          todayChange={todayPerformance.changeAed}
          todayChangePercent={todayPerformance.changePercent}
          isAmountsVisible={isAmountsVisible}
          snapshots={snapshots}
          refreshError={refreshError}
          refreshFailures={refreshFailures}
        />
      </div>
    </div>
  );
}
