"use client";

import { useMemo } from "react";
import { useActivityHoldingsEngine } from "@/hooks/useActivityHoldingsEngine";
import { useDashboardHoldings } from "@/hooks/useDashboardHoldings";
import { useDashboardRefresh } from "@/hooks/useDashboardRefresh";
import { usePortfolioSnapshots } from "@/hooks/usePortfolioSnapshots";
import { useDashboardVisibility } from "@/hooks/useDashboardVisibility";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { useTransactions } from "@/hooks/useTransactions";
import { getCashBalances } from "@/lib/cash-balances";

export function useDashboardState(initialUserId: string) {
  const holdingsState = useDashboardHoldings(initialUserId);
  const transactionState = useTransactions(holdingsState.userId);
  const activityEngine = useActivityHoldingsEngine({
    mounted: holdingsState.mounted,
    transactionsHydrated: transactionState.initialSyncComplete,
    userId: holdingsState.userId,
    holdings: holdingsState.holdings,
    setHoldings: holdingsState.setHoldings,
    transactions: transactionState.transactions,
    inrToAedRate: holdingsState.inrToAedRate,
  });
  const refreshState = useDashboardRefresh({
    mounted: holdingsState.mounted,
    holdings: holdingsState.holdings,
    setHoldings: holdingsState.setHoldings,
    setInrToAedRate: holdingsState.setInrToAedRate,
    setFxUpdatedAt: holdingsState.setFxUpdatedAt,
  });
  const visibilityState = useDashboardVisibility();
  const summaryState = usePortfolioSummary(holdingsState.holdings, holdingsState.inrToAedRate);
  const cash = useMemo(
    () =>
      getCashBalances(
        transactionState.transactions,
        holdingsState.holdings,
        holdingsState.inrToAedRate
      ),
    [
      holdingsState.holdings,
      holdingsState.inrToAedRate,
      transactionState.transactions,
    ]
  );
  const snapshotsState = usePortfolioSnapshots({
    mounted: holdingsState.mounted && activityEngine.activityEngineSettled,
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
    transactions: transactionState.transactions,
    transactionsMounted: transactionState.mounted,
    transactionSyncWarning: transactionState.syncWarning,
    saveTransaction: transactionState.saveTransaction,
    deleteTransaction: transactionState.deleteTransaction,
    importTransactions: transactionState.importTransactions,
    ...activityEngine,
    cash,
  };
}
