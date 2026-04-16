"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchPortfolioSnapshots,
  persistLocalPortfolioSnapshots,
  syncPortfolioSnapshot,
  type PortfolioSnapshot,
  upsertSnapshotInList,
} from "@/lib/portfolio-snapshots";

interface SummarySnapshotInput {
  totalValue: number;
  totalInvested: number;
  totalGainLoss: number;
}

interface UsePortfolioSnapshotsOptions {
  mounted: boolean;
  userId: string;
  holdingsCount: number;
  summary: SummarySnapshotInput;
}

function getTodaySnapshotDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function usePortfolioSnapshots({
  mounted,
  userId,
  holdingsCount,
  summary,
}: UsePortfolioSnapshotsOptions) {
  const [storedSnapshots, setStoredSnapshots] = useState<PortfolioSnapshot[]>([]);

  const snapshot = useMemo<PortfolioSnapshot>(() => ({
    snapshotDate: getTodaySnapshotDate(),
    totalValueAed: summary.totalValue,
    totalInvestedAed: summary.totalInvested,
    totalGainLossAed: summary.totalGainLoss,
    holdingsCount,
  }), [holdingsCount, summary.totalGainLoss, summary.totalInvested, summary.totalValue]);

  const snapshots = useMemo(
    () => upsertSnapshotInList(storedSnapshots, snapshot),
    [snapshot, storedSnapshots]
  );

  useEffect(() => {
    if (!mounted) {
      return;
    }

    let active = true;

    void (async () => {
      const history = await fetchPortfolioSnapshots(userId);
      if (active) {
        setStoredSnapshots(history);
      }
    })();

    return () => {
      active = false;
    };
  }, [mounted, userId]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    persistLocalPortfolioSnapshots(userId, snapshots);

    void (async () => {
      try {
        await syncPortfolioSnapshot(userId, snapshot);
      } catch (error) {
        console.error("Failed to sync portfolio snapshot:", error);
      }
    })();
  }, [mounted, snapshot, snapshots, userId]);

  return { snapshots };
}
