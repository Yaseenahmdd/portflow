"use client";

import { useState } from "react";
import HoldingDetailsModal from "@/components/HoldingDetailsModal";
import HoldingModal from "@/components/HoldingModal";
import DashboardHoldingsContent from "@/components/dashboard/DashboardHoldingsContent";
import DashboardPullToRefreshIndicator from "@/components/dashboard/DashboardPullToRefreshIndicator";
import DashboardRefreshNotices from "@/components/dashboard/DashboardRefreshNotices";
import { useDashboardStateContext } from "@/components/dashboard/DashboardStateProvider";
import type { Holding } from "@/lib/constants";

export default function DashboardHoldingsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [viewingHolding, setViewingHolding] = useState<Holding | null>(null);
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
    saveHolding,
    deleteHolding,
    updatePrice,
  } = useDashboardStateContext();

  const handleSaveHolding = (holding: Holding) => {
    saveHolding(holding);
    setModalOpen(false);
    setEditingHolding(null);
  };

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-[28rem] rounded-2xl" />
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

      <div className="space-y-4 sm:space-y-6">
        <DashboardRefreshNotices refreshError={refreshError} refreshFailures={refreshFailures} />

        <DashboardHoldingsContent
          holdings={computedHoldings}
          isAmountsVisible={isAmountsVisible}
          onView={setViewingHolding}
          onEdit={(holding) => {
            setEditingHolding(holding);
            setModalOpen(true);
          }}
          onDelete={deleteHolding}
          onPriceUpdate={updatePrice}
          onAddHolding={() => {
            setEditingHolding(null);
            setModalOpen(true);
          }}
        />
      </div>

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
