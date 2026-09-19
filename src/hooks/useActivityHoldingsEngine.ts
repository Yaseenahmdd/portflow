"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Holding } from "@/lib/constants";
import {
  loadLedgerConnectionState,
  persistLedgerConnectionState,
  reconcileHoldingsFromLedger,
} from "@/lib/ledger-holdings";
import type { PortfolioTransaction } from "@/lib/transactions";

interface ActivityHoldingsEngineOptions {
  mounted: boolean;
  transactionsHydrated: boolean;
  userId: string;
  holdings: Holding[];
  setHoldings: Dispatch<SetStateAction<Holding[]>>;
  transactions: PortfolioTransaction[];
  inrToAedRate: number;
}

export function useActivityHoldingsEngine({
  mounted,
  transactionsHydrated,
  userId,
  holdings,
  setHoldings,
  transactions,
  inrToAedRate,
}: ActivityHoldingsEngineOptions) {
  const [rememberedState, setRememberedState] = useState<{
    userId: string;
    managedHoldingIds: string[];
  }>({ userId: "", managedHoldingIds: [] });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const stored = loadLedgerConnectionState(userId);
      setRememberedState({ userId, managedHoldingIds: stored.managedHoldingIds });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [userId]);

  const ready = rememberedState.userId === userId;
  const rememberedHoldingIds = useMemo(
    () => (ready ? rememberedState.managedHoldingIds : []),
    [ready, rememberedState.managedHoldingIds]
  );
  const reconciliation = useMemo(
    () =>
      reconcileHoldingsFromLedger(
        holdings,
        transactions,
        inrToAedRate,
        rememberedHoldingIds
      ),
    [holdings, inrToAedRate, rememberedHoldingIds, transactions]
  );

  useEffect(() => {
    if (!mounted || !transactionsHydrated || !ready || reconciliation.issues.length) return;

    const currentIds = [...rememberedHoldingIds].sort().join("|");
    const nextIds = [...reconciliation.managedHoldingIds].sort().join("|");
    if (!reconciliation.changes.length && currentIds === nextIds) return;

    const timeoutId = window.setTimeout(() => {
      if (reconciliation.changes.length) {
        setHoldings((current) => {
          const latest = reconcileHoldingsFromLedger(
            current,
            transactions,
            inrToAedRate,
            reconciliation.managedHoldingIds
          );
          return latest.issues.length || !latest.changes.length ? current : latest.nextHoldings;
        });
      }

      if (currentIds !== nextIds) {
        setRememberedState({
          userId,
          managedHoldingIds: reconciliation.managedHoldingIds,
        });
      }

      persistLedgerConnectionState(userId, {
        enabled: true,
        managedHoldingIds: reconciliation.managedHoldingIds,
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    inrToAedRate,
    mounted,
    ready,
    reconciliation,
    rememberedHoldingIds,
    setHoldings,
    transactions,
    transactionsHydrated,
    userId,
  ]);

  return {
    activityEngineReady: mounted && transactionsHydrated && ready,
    activityEngineSettled:
      mounted &&
      transactionsHydrated &&
      ready &&
      !reconciliation.changes.length &&
      !reconciliation.issues.length,
    activityManagedHoldingIds: reconciliation.managedHoldingIds,
    activityReconciliation: reconciliation,
  };
}
