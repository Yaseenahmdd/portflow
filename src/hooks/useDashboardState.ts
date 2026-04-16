"use client";

import { useDashboardHoldings } from "@/hooks/useDashboardHoldings";
import { useDashboardRefresh } from "@/hooks/useDashboardRefresh";
import { usePortfolioSnapshots } from "@/hooks/usePortfolioSnapshots";
import { useDashboardVisibility } from "@/hooks/useDashboardVisibility";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";

export function useDashboardState() {
  const holdingsState = useDashboardHoldings();
  const refreshState = useDashboardRefresh({
    mounted: holdingsState.mounted,
    holdings: holdingsState.holdings,
    setHoldings: holdingsState.setHoldings,
    setInrToAedRate: holdingsState.setInrToAedRate,
    setFxUpdatedAt: holdingsState.setFxUpdatedAt,
  });
  const visibilityState = useDashboardVisibility();
  const summaryState = usePortfolioSummary(holdingsState.holdings, holdingsState.inrToAedRate);
  const snapshotsState = usePortfolioSnapshots({
    mounted: holdingsState.mounted,
    userId: holdingsState.userId,
    holdingsCount: holdingsState.holdings.length,
    summary: {
      totalValue: summaryState.summary.totalValue,
      totalInvested: summaryState.summary.totalInvested,
      totalGainLoss: summaryState.summary.totalGainLoss,
    },
  });

  return {
    ...holdingsState,
    ...refreshState,
    ...visibilityState,
    ...summaryState,
    ...snapshotsState,
  };
}
