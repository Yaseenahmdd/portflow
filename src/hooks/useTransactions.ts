"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteRemoteTransaction,
  fetchRemoteTransactions,
  loadLocalTransactions,
  persistLocalTransactions,
  sortTransactions,
  upsertRemoteTransactions,
} from "@/lib/transactions-store";
import { normalizeTransaction, type PortfolioTransaction } from "@/lib/transactions";

export function useTransactions(userId: string) {
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [mounted, setMounted] = useState(false);
  const [initialSyncUserId, setInitialSyncUserId] = useState("");
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const localTransactions = loadLocalTransactions(userId);
      if (active) {
        setTransactions(localTransactions);
        setMounted(true);
      }

      try {
        const remoteTransactions = await fetchRemoteTransactions(userId);
        if (!active || remoteTransactions === null) return;

        if (!remoteTransactions.length && localTransactions.length) {
          await upsertRemoteTransactions(userId, localTransactions);
          return;
        }

        setTransactions(remoteTransactions);
        persistLocalTransactions(userId, remoteTransactions);
        setSyncWarning(null);
      } catch (error) {
        if (active) {
          setSyncWarning("Transactions are saved on this device until the database migration is applied.");
          console.error("Failed to sync transactions:", error);
        }
      } finally {
        if (active) setInitialSyncUserId(userId);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  const saveTransaction = useCallback((transaction: PortfolioTransaction) => {
    const now = new Date().toISOString();
    const normalized = normalizeTransaction({
      ...transaction,
      id: transaction.id || crypto.randomUUID(),
      createdAt: transaction.createdAt || now,
      updatedAt: now,
    });

    setTransactions((current) => {
      const exists = current.some((item) => item.id === normalized.id);
      const next = sortTransactions(
        exists
          ? current.map((item) => (item.id === normalized.id ? normalized : item))
          : [normalized, ...current]
      );
      persistLocalTransactions(userId, next);
      return next;
    });

    void upsertRemoteTransactions(userId, [normalized])
      .then(() => setSyncWarning(null))
      .catch((error) => {
        setSyncWarning("Saved on this device, but cloud sync is not available yet.");
        console.error("Failed to save transaction remotely:", error);
      });

    return normalized;
  }, [userId]);

  const deleteTransaction = useCallback((transactionId: string) => {
    setTransactions((current) => {
      const next = current.filter((transaction) => transaction.id !== transactionId);
      persistLocalTransactions(userId, next);
      return next;
    });

    void deleteRemoteTransaction(userId, transactionId).catch((error) => {
      setSyncWarning("Deleted on this device, but the cloud copy could not be updated.");
      console.error("Failed to delete transaction remotely:", error);
    });
  }, [userId]);

  const importTransactions = useCallback((newTransactions: PortfolioTransaction[]) => {
    if (!newTransactions.length) return;

    const now = new Date().toISOString();
    const normalizedTransactions = newTransactions.map((transaction) =>
      normalizeTransaction({
        ...transaction,
        createdAt: transaction.createdAt || now,
        updatedAt: now,
      })
    );

    setTransactions((current) => {
      const existingIds = new Set(current.map((transaction) => transaction.id));
      const additions = normalizedTransactions.filter(
        (transaction) => !existingIds.has(transaction.id)
      );
      const next = sortTransactions([...current, ...additions]);
      persistLocalTransactions(userId, next);
      return next;
    });

    void upsertRemoteTransactions(userId, normalizedTransactions)
      .then(() => setSyncWarning(null))
      .catch((error) => {
        setSyncWarning("Imported on this device, but the cloud copy could not be updated.");
        console.error("Failed to import transactions remotely:", error);
      });
  }, [userId]);

  return {
    transactions,
    mounted,
    initialSyncComplete: initialSyncUserId === userId,
    syncWarning,
    saveTransaction,
    deleteTransaction,
    importTransactions,
  };
}
