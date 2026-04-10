"use client";

import { useEffect, useState } from "react";
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
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    let active = true;

    void (async () => {
      const history = await fetchPortfolioSnapshots(userId);
      if (active) {
        setSnapshots(history);
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

    const snapshot: PortfolioSnapshot = {
      snapshotDate: getTodaySnapshotDate(),
      totalValueAed: summary.totalValue,
      totalInvestedAed: summary.totalInvested,
      totalGainLossAed: summary.totalGainLoss,
      holdingsCount,
    };

    const timeoutId = window.setTimeout(async () => {
      setSnapshots((current) => {
        const next = upsertSnapshotInList(current, snapshot);
        persistLocalPortfolioSnapshots(userId, next);
        return next;
      });

      try {
        await syncPortfolioSnapshot(userId, snapshot);
      } catch (error) {
        console.error("Failed to sync portfolio snapshot:", error);
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [mounted, userId, holdingsCount, summary.totalGainLoss, summary.totalInvested, summary.totalValue]);

  return { snapshots };
}
