"use client";

import DashboardHistoryContent from "@/components/dashboard/DashboardHistoryContent";
import DashboardPullToRefreshIndicator from "@/components/dashboard/DashboardPullToRefreshIndicator";
import DashboardRefreshNotices from "@/components/dashboard/DashboardRefreshNotices";
import { useDashboardStateContext } from "@/components/dashboard/DashboardStateProvider";

export default function DashboardHistoryPage() {
  const {
    mounted,
    isAmountsVisible,
    isRefreshing,
    isPullRefreshing,
    pullDistance,
    refreshFailures,
    refreshError,
    computedHoldings,
    snapshots,
  } = useDashboardStateContext();

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-[22rem] rounded-2xl" />
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

      <DashboardRefreshNotices refreshError={refreshError} refreshFailures={refreshFailures} />

      <DashboardHistoryContent
        holdings={computedHoldings}
        snapshots={snapshots}
        isAmountsVisible={isAmountsVisible}
      />
    </div>
  );
}
