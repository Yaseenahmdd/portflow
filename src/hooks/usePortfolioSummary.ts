"use client";

import { useMemo } from "react";
import type { Holding } from "@/lib/constants";
import { computeHolding } from "@/lib/utils";

export function usePortfolioSummary(holdings: Holding[], inrToAedRate: number) {
  const computedHoldings = useMemo(
    () => holdings.map((holding) => computeHolding(holding, inrToAedRate)),
    [holdings, inrToAedRate]
  );

  const summary = useMemo(() => {
    const totalInvested = computedHoldings.reduce((sum, holding) => sum + holding.investedAmountAed, 0);
    const totalValue = computedHoldings.reduce((sum, holding) => sum + holding.currentValueAed, 0);
    const totalGainLoss = computedHoldings.reduce((sum, holding) => sum + holding.gainLossAed, 0);
    const totalGainLossPct = totalInvested ? (totalGainLoss / totalInvested) * 100 : 0;

    return { totalInvested, totalValue, totalGainLoss, totalGainLossPct };
  }, [computedHoldings]);

  return { computedHoldings, summary };
}
