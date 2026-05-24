"use client";

import { useCallback, useEffect, useState } from "react";
import type { Holding } from "@/lib/constants";
import {
  DEFAULT_FX_UPDATED_AT,
  DEFAULT_INR_TO_AED_RATE,
  loadDashboardPersistenceState,
  persistDashboardRate,
  persistFxUpdatedAt,
  persistLocalHoldings,
  syncRemoteHoldings,
} from "@/lib/dashboard/persistence";
import { normalizeHoldings } from "@/lib/holdings-normalize";
import { isRefreshTokenReuseError } from "@/lib/supabase/errors";
import { generateId } from "@/lib/utils";

export function useDashboardHoldings(initialUserId: string) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [inrToAedRate, setInrToAedRate] = useState(DEFAULT_INR_TO_AED_RATE);
  const [fxUpdatedAt, setFxUpdatedAt] = useState<string | null>(DEFAULT_FX_UPDATED_AT);
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState(initialUserId);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const state = await loadDashboardPersistenceState(initialUserId);
        if (!active) {
          return;
        }

        setUserId(state.userId);
        setHoldings(state.holdings);
        setInrToAedRate(state.inrToAedRate);
        setFxUpdatedAt(state.fxUpdatedAt);
      } catch (error) {
        if (!isRefreshTokenReuseError(error)) {
          console.error("Failed to load dashboard holdings:", error);
        }
      } finally {
        if (active) {
          setMounted(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [initialUserId]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    persistLocalHoldings(userId, holdings);

    const timeoutId = window.setTimeout(async () => {
      try {
        await syncRemoteHoldings(userId, holdings);
      } catch (error) {
        if (!isRefreshTokenReuseError(error)) {
          console.error("Failed to sync holdings to Supabase:", error);
        }
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [holdings, mounted, userId]);

  useEffect(() => {
    if (mounted) {
      persistDashboardRate(userId, inrToAedRate);
    }
  }, [inrToAedRate, mounted, userId]);

  useEffect(() => {
    if (mounted) {
      persistFxUpdatedAt(userId, fxUpdatedAt);
    }
  }, [fxUpdatedAt, mounted, userId]);

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
    fxUpdatedAt,
    setFxUpdatedAt,
    saveHolding,
    deleteHolding,
    updatePrice,
  };
}
