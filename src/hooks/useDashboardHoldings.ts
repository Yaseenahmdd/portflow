"use client";

import { useCallback, useEffect, useState } from "react";
import type { Holding } from "@/lib/constants";
import {
  DEFAULT_INR_TO_AED_RATE,
  loadDashboardPersistenceState,
  persistDashboardRate,
  persistLocalHoldings,
  syncRemoteHoldings,
} from "@/lib/dashboard/persistence";
import { normalizeHoldings } from "@/lib/holdings-normalize";
import { generateId } from "@/lib/utils";

export function useDashboardHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [inrToAedRate, setInrToAedRate] = useState(DEFAULT_INR_TO_AED_RATE);
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState("default");

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const state = await loadDashboardPersistenceState();
        if (!active) {
          return;
        }

        setUserId(state.userId);
        setHoldings(state.holdings);
        setInrToAedRate(state.inrToAedRate);
      } catch (error) {
        console.error("Failed to load dashboard holdings:", error);
      } finally {
        if (active) {
          setMounted(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    persistLocalHoldings(userId, holdings);

    const timeoutId = window.setTimeout(async () => {
      try {
        await syncRemoteHoldings(userId, holdings);
      } catch (error) {
        console.error("Failed to sync holdings to Supabase:", error);
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [holdings, mounted, userId]);

  useEffect(() => {
    if (mounted) {
      persistDashboardRate(userId, inrToAedRate);
    }
  }, [inrToAedRate, mounted, userId]);

  const saveHolding = useCallback((holding: Holding) => {
    const normalizedHolding = normalizeHoldings([holding]).normalized[0];

    setHoldings((current) => {
      const exists = current.some((item) => item.id === normalizedHolding.id);
      if (exists) {
        return current.map((item) => (item.id === normalizedHolding.id ? normalizedHolding : item));
      }

      return [{ ...normalizedHolding, id: generateId() }, ...current];
    });
  }, []);

  const deleteHolding = useCallback((id: string) => {
    setHoldings((current) => current.filter((holding) => holding.id !== id));
  }, []);

  const updatePrice = useCallback((id: string, price: number) => {
    setHoldings((current) =>
      current.map((holding) => (holding.id === id ? { ...holding, currentPrice: price } : holding))
    );
  }, []);

  return {
    mounted,
    userId,
    holdings,
    setHoldings,
    inrToAedRate,
    setInrToAedRate,
    saveHolding,
    deleteHolding,
    updatePrice,
  };
}
