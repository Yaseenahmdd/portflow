"use client";

import { useMemo, useState } from "react";
import AllocationCharts from "@/components/AllocationCharts";
import HoldingDetailsModal from "@/components/HoldingDetailsModal";
import HoldingModal from "@/components/HoldingModal";
import HoldingsTable from "@/components/HoldingsTable";
import PortfolioSummaryStrip from "@/components/PortfolioSummaryStrip";
import PortfolioTrendChart from "@/components/PortfolioTrendChart";
import { useDashboardState } from "@/hooks/useDashboardState";
import type { Holding } from "@/lib/constants";
import { getAedRate, toNumber } from "@/lib/utils";

function getInvestedAmountAedOnDate(holding: Holding, snapshotDate: string, inrToAedRate: number) {
  const snapshotTime = new Date(`${snapshotDate}T23:59:59`).getTime();

  if (holding.purchases?.length) {
    return holding.purchases.reduce((sum, purchase) => {
      const purchaseTime = new Date(`${purchase.date}T23:59:59`).getTime();

      if (Number.isNaN(purchaseTime) || purchaseTime > snapshotTime) {
        return sum;
      }

      const quantity = toNumber(purchase.quantity);
      const price = toNumber(purchase.price);
      const rateToAed =
        holding.currency === "INR"
          ? toNumber(purchase.fxRate) || inrToAedRate
          : getAedRate(holding.currency, inrToAedRate);

      return sum + quantity * price * rateToAed;
    }, 0);
  }

  const quantity = toNumber(holding.quantity);
  const avgBuyPrice = toNumber(holding.avgBuyPrice);
  const rateToAed = getAedRate(holding.currency, inrToAedRate);
  return quantity * avgBuyPrice * rateToAed;
}

export default function DashboardPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [viewingHolding, setViewingHolding] = useState<Holding | null>(null);
  const {
    mounted,
    holdings,
    inrToAedRate,
    isAmountsVisible,
    isRefreshing,
    isPullRefreshing,
    pullDistance,
    computedHoldings,
    summary,
    snapshots,
    saveHolding,
    deleteHolding,
    updatePrice,
  } = useDashboardState();

  const handleSaveHolding = (holding: Holding) => {
    saveHolding(holding);
    setModalOpen(false);
    setEditingHolding(null);
  };

  const handleEdit = (holding: Holding) => {
    setEditingHolding(holding);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteHolding(id);
  };

  const handlePriceUpdate = (id: string, price: number) => {
    updatePrice(id, price);
  };
  const trendChartData = useMemo(
    () =>
      snapshots.map((snapshot) => ({
        date: snapshot.snapshotDate,
        invested: holdings.reduce(
          (sum, holding) => sum + getInvestedAmountAedOnDate(holding, snapshot.snapshotDate, inrToAedRate),
          0
        ),
        value: snapshot.totalValueAed,
      })),
    [holdings, inrToAedRate, snapshots]
  );
  const previousTrendPoint = trendChartData.length > 1 ? trendChartData[trendChartData.length - 2] : null;
  const latestTrendPoint = trendChartData[trendChartData.length - 1] ?? null;
  const latestGainLoss = latestTrendPoint ? latestTrendPoint.value - latestTrendPoint.invested : 0;
  const previousGainLoss = previousTrendPoint ? previousTrendPoint.value - previousTrendPoint.invested : 0;
  const dailyChange = latestTrendPoint && previousTrendPoint
    ? latestGainLoss - previousGainLoss
    : 0;
  const dailyChangePercent = previousTrendPoint?.value
    ? (dailyChange / previousTrendPoint.value) * 100
    : 0;

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-56" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-[22rem] rounded-2xl" />
        <div className="grid gap-4 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="skeleton h-72 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-[28rem] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div
        className="pointer-events-none fixed left-1/2 top-[5.25rem] z-30 flex -translate-x-1/2 justify-center transition-all duration-150 sm:top-[6.25rem]"
        style={{
          transform: `translate(-50%, ${pullDistance ? Math.min(pullDistance - 24, 36) : isPullRefreshing ? 36 : -28}px)`,
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
          </svg>
          <span>
            {isRefreshing ? "Refreshing..." : pullDistance >= 72 ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      </div>

      <PortfolioSummaryStrip
        portfolioValue={summary.totalValue}
        investedAmount={summary.totalInvested}
        totalGainLoss={summary.totalGainLoss}
        totalGainLossPercent={summary.totalGainLossPct}
        dailyChange={dailyChange}
        dailyChangePercent={dailyChangePercent}
        fxRate={inrToAedRate ? 1 / inrToAedRate : 0}
        isAmountsVisible={isAmountsVisible}
      />

      <PortfolioTrendChart
        chartData={trendChartData}
        isAmountsVisible={isAmountsVisible}
      />

      <AllocationCharts holdings={computedHoldings} totalValue={summary.totalValue} />

      <HoldingsTable
        holdings={computedHoldings}
        isAmountsVisible={isAmountsVisible}
        onView={setViewingHolding}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPriceUpdate={handlePriceUpdate}
        onAddHolding={() => {
          setEditingHolding(null);
          setModalOpen(true);
        }}
      />

      {modalOpen && (
        <HoldingModal
          holding={editingHolding}
          inrToAedRate={inrToAedRate}
          onSave={handleSaveHolding}
          onClose={() => {
            setModalOpen(false);
            setEditingHolding(null);
          }}
        />
      )}

      {viewingHolding && (
        <HoldingDetailsModal
          holding={viewingHolding}
          inrToAedRate={inrToAedRate}
          onClose={() => setViewingHolding(null)}
        />
      )}
    </div>
  );
}
