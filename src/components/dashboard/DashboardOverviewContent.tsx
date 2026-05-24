"use client";

import AllocationCharts from "@/components/AllocationCharts";
import PortfolioSummaryStrip from "@/components/PortfolioSummaryStrip";
import PortfolioTrendChart from "@/components/PortfolioTrendChart";
import DashboardRefreshNotices from "@/components/dashboard/DashboardRefreshNotices";
import type { ComputedHolding } from "@/lib/constants";
import type { RefreshFailure } from "@/lib/dashboard/refresh";

interface TrendPoint {
  date: string;
  invested: number;
  value: number;
}

interface DashboardOverviewContentProps {
  holdings: ComputedHolding[];
  totalValue: number;
  totalInvested: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dailyChange: number;
  dailyChangePercent: number;
  isAmountsVisible: boolean;
  trendChartData: TrendPoint[];
  refreshError: string | null;
  refreshFailures: RefreshFailure[];
}

export default function DashboardOverviewContent({
  holdings,
  totalValue,
  totalInvested,
  totalGainLoss,
  totalGainLossPercent,
  dailyChange,
  dailyChangePercent,
  isAmountsVisible,
  trendChartData,
  refreshError,
  refreshFailures,
}: DashboardOverviewContentProps) {
  return (
    <>
      <PortfolioSummaryStrip
        holdingsCount={holdings.length}
        portfolioValue={totalValue}
        investedAmount={totalInvested}
        totalGainLoss={totalGainLoss}
        totalGainLossPercent={totalGainLossPercent}
        dailyChange={dailyChange}
        dailyChangePercent={dailyChangePercent}
        isAmountsVisible={isAmountsVisible}
        portfolioHistory={trendChartData.map((point) => ({ value: point.value }))}
      />

      <DashboardRefreshNotices refreshError={refreshError} refreshFailures={refreshFailures} />

      <PortfolioTrendChart chartData={trendChartData} isAmountsVisible={isAmountsVisible} />

      <AllocationCharts holdings={holdings} totalValue={totalValue} totalInvested={totalInvested} />
    </>
  );
}
