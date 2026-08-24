"use client";

interface DashboardPullToRefreshIndicatorProps {
  pullDistance: number;
  isPullRefreshing: boolean;
  isRefreshing: boolean;
}

const PULL_THRESHOLD = 72;

export default function DashboardPullToRefreshIndicator({
  pullDistance,
  isPullRefreshing,
  isRefreshing,
}: DashboardPullToRefreshIndicatorProps) {
  return (
    <div
      className="pointer-events-none fixed left-1/2 top-[5.25rem] z-30 flex justify-center transition-all duration-150 sm:top-[6.25rem]"
      style={{
        transform: `translate3d(-50%, ${pullDistance ? Math.min(pullDistance - 24, 36) : isPullRefreshing ? 36 : -28}px, 0)`,
        opacity: isPullRefreshing || pullDistance > 0 ? 1 : 0,
      }}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
        <svg
          className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          style={{
            transform: !isRefreshing ? `rotate(${Math.min(pullDistance * 2.4, 180)}deg)` : undefined,
          }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183"
          />
        </svg>
        <span>
          {isRefreshing ? "Refreshing..." : pullDistance >= PULL_THRESHOLD ? "Release to refresh" : "Pull to refresh"}
        </span>
      </div>
    </div>
  );
}
