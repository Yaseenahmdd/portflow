"use client";

import type { RefreshFailure } from "@/lib/dashboard/refresh";

function formatRefreshSource(source: string) {
  return source
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function summarizeRefreshFailures(sources: string[]) {
  if (sources.length === 0) {
    return "";
  }

  if (sources.length === 1) {
    return formatRefreshSource(sources[0]);
  }

  if (sources.length === 2) {
    return `${formatRefreshSource(sources[0])} and ${formatRefreshSource(sources[1])}`;
  }

  return `${sources.length} sources`;
}

interface DashboardRefreshNoticesProps {
  refreshError: string | null;
  refreshFailures: RefreshFailure[];
}

export default function DashboardRefreshNotices({
  refreshError,
  refreshFailures,
}: DashboardRefreshNoticesProps) {
  const failedSources = refreshFailures.map((failure) => failure.source);
  const failureSummary = summarizeRefreshFailures(failedSources);

  return (
    <>
      {refreshError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Refresh failed. Existing prices are still shown. {refreshError}
        </div>
      ) : null}

      {!refreshError && refreshFailures.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Prices updated, but {failureSummary} {refreshFailures.length === 1 ? "was" : "were"} unavailable.
        </div>
      ) : null}
    </>
  );
}
