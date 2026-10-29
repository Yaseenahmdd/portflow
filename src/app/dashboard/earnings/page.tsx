"use client";

import DashboardEarningsContent from "@/components/dashboard/DashboardEarningsContent";
import DashboardPullToRefreshIndicator from "@/components/dashboard/DashboardPullToRefreshIndicator";
import { useDashboardStateContext } from "@/components/dashboard/DashboardStateProvider";

export default function DashboardEarningsPage() {
  const {
    mounted,
    isAmountsVisible,
    isRefreshing,
    isPullRefreshing,
    pullDistance,
    computedHoldings,
    summary,
    activityEngineReady,
  } = useDashboardStateContext();

  if (!mounted || !activityEngineReady) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-[28rem] rounded-2xl" />
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

      <DashboardEarningsContent
        holdings={computedHoldings}
        totalValue={summary.totalValue}
        isAmountsVisible={isAmountsVisible}
      />
    </div>
  );
}
