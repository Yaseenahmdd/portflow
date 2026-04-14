"use client";

import { useDashboardHoldings } from "@/hooks/useDashboardHoldings";
import { useDashboardRefresh } from "@/hooks/useDashboardRefresh";
import { useLiveCryptoPrices } from "@/hooks/useLiveCryptoPrices";
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
  const liveCryptoState = useLiveCryptoPrices({
    holdings: holdingsState.holdings,
    inrToAedRate: holdingsState.inrToAedRate,
    applyLivePrices: holdingsState.applyLivePrices,
    clearLivePrices: holdingsState.clearLivePrices,
  });
  const summaryState = usePortfolioSummary(holdingsState.displayHoldings, holdingsState.inrToAedRate);
  const persistedSummaryState = usePortfolioSummary(holdingsState.holdings, holdingsState.inrToAedRate);
  const snapshotsState = usePortfolioSnapshots({
    mounted: holdingsState.mounted,
    userId: holdingsState.userId,
    holdingsCount: holdingsState.holdings.length,
    summary: {
      totalValue: persistedSummaryState.summary.totalValue,
      totalInvested: persistedSummaryState.summary.totalInvested,
      totalGainLoss: persistedSummaryState.summary.totalGainLoss,
    },
  });

  return {
    ...holdingsState,
    ...refreshState,
    liveCryptoState,
    ...visibilityState,
    ...summaryState,
    ...snapshotsState,
  };
}
