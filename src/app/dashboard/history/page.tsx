"use client";

import DashboardHistoryContent from "@/components/dashboard/DashboardHistoryContent";
import DashboardPullToRefreshIndicator from "@/components/dashboard/DashboardPullToRefreshIndicator";
import DashboardRefreshNotices from "@/components/dashboard/DashboardRefreshNotices";
import { useDashboardStateContext } from "@/components/dashboard/DashboardStateProvider";

export default function DashboardHistoryPage() {
  const {
    mounted,
    inrToAedRate,
    isAmountsVisible,
    isRefreshing,
    isPullRefreshing,
    pullDistance,
    refreshFailures,
    refreshError,
    computedHoldings,
    snapshots,
    transactions,
    transactionsMounted,
    activityEngineReady,
  } = useDashboardStateContext();

  if (!mounted || !transactionsMounted || !activityEngineReady) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-28" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2].map((item) => (
            <div key={item} className="skeleton h-44 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
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
        transactions={transactions}
        inrToAedRate={inrToAedRate}
        isAmountsVisible={isAmountsVisible}
      />
    </div>
  );
}
