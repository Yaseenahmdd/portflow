"use client";

import HoldingsTable from "@/components/HoldingsTable";
import type { ComputedHolding, Holding } from "@/lib/constants";

interface DashboardHoldingsContentProps {
  holdings: ComputedHolding[];
  isAmountsVisible: boolean;
  onView: (holding: Holding) => void;
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
  onPriceUpdate: (id: string, price: number) => void;
  onAddHolding: () => void;
  onExport?: () => void;
}

export default function DashboardHoldingsContent({
  holdings,
  isAmountsVisible,
  onView,
  onEdit,
  onDelete,
  onPriceUpdate,
  onAddHolding,
  onExport,
}: DashboardHoldingsContentProps) {
  return (
    <HoldingsTable
      holdings={holdings}
      isAmountsVisible={isAmountsVisible}
      onView={onView}
      onEdit={onEdit}
      onDelete={onDelete}
      onPriceUpdate={onPriceUpdate}
      onAddHolding={onAddHolding}
      onExport={onExport}
    />
  );
}
