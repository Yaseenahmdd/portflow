"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Holding } from "@/lib/constants";
import {
  DEFAULT_INR_TO_AED_RATE,
  loadDashboardPersistenceState,
  persistDashboardRate,
  persistLocalHoldings,
  syncDashboardHoldingsFromRemote,
  upsertRemoteHoldingsState,
  deleteRemoteHoldingState,
} from "@/lib/dashboard/persistence";
import { normalizeHoldings } from "@/lib/holdings-normalize";
import { generateId } from "@/lib/utils";

const REMOTE_SYNC_INTERVAL_MS = 30 * 1000;
const REMOTE_SYNC_COOLDOWN_MS = 2500;
const REMOTE_WRITE_DEBOUNCE_MS = 2500;

const PRICE_ONLY_FIELDS = new Set(["currentPrice", "lastPriceUpdate"]);

/** Signature of fields that warrant a remote write when changed.
 *  Excludes currentPrice and lastPriceUpdate so price refreshes
 *  don't trigger unnecessary Supabase writes. */
function getHoldingsStructureSignature(holdings: Holding[]) {
  return JSON.stringify(
    holdings.map((h) =>
      Object.fromEntries(Object.entries(h).filter(([k]) => !PRICE_ONLY_FIELDS.has(k)))
    )
  );
}

function getHoldingsSignature(holdings: Holding[]) {
  return JSON.stringify(holdings);
}

export function useDashboardHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [inrToAedRate, setInrToAedRate] = useState(DEFAULT_INR_TO_AED_RATE);
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState("default");
  const holdingsRef = useRef<Holding[]>([]);
  const lastLocalMutationAtRef = useRef(0);
  const remoteSyncInFlightRef = useRef(false);
  const lastWrittenStructureRef = useRef<string>("");

  useEffect(() => {
    holdingsRef.current = holdings;
  }, [holdings]);

  const syncFromRemote = useCallback(async (force = false) => {
    if (!mounted || userId === "default" || remoteSyncInFlightRef.current) {
      return;
    }

    if (!force && Date.now() - lastLocalMutationAtRef.current < REMOTE_SYNC_COOLDOWN_MS) {
      return;
    }

    remoteSyncInFlightRef.current = true;

    try {
      const remoteHoldings = await syncDashboardHoldingsFromRemote(userId);
      if (!remoteHoldings) {
        return;
      }

      if (remoteHoldings.length === 0 && holdingsRef.current.length > 0) {
        await upsertRemoteHoldingsState(userId, holdingsRef.current);
        return;
      }

      if (getHoldingsSignature(remoteHoldings) !== getHoldingsSignature(holdingsRef.current)) {
        setHoldings(remoteHoldings);
      }
    } catch (error) {
      console.error("Failed to sync holdings from Supabase:", error);
    } finally {
      remoteSyncInFlightRef.current = false;
    }
  }, [mounted, userId]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const state = await loadDashboardPersistenceState();
        if (!active) {
          return;
        }

        holdingsRef.current = state.holdings;
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

    // Skip remote write if only prices changed — price refreshes update
    // currentPrice/lastPriceUpdate frequently and don't need to be persisted
    // on every tick. Structure changes (adds, deletes, edits) always write.
    const structureSignature = getHoldingsStructureSignature(holdings);
    if (structureSignature === lastWrittenStructureRef.current) {
      return;
    }

    lastLocalMutationAtRef.current = Date.now();

    const timeoutId = window.setTimeout(async () => {
      try {
        await upsertRemoteHoldingsState(userId, holdings);
        lastWrittenStructureRef.current = structureSignature;
      } catch (error) {
        console.error("Failed to sync holdings to Supabase:", error);
      }
    }, REMOTE_WRITE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [holdings, mounted, userId]);

  useEffect(() => {
    if (mounted) {
      persistDashboardRate(userId, inrToAedRate);
    }
  }, [inrToAedRate, mounted, userId]);

  useEffect(() => {
    if (!mounted || userId === "default") {
      return;
    }

    const handleWindowFocus = () => {
      void syncFromRemote(true);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void syncFromRemote(true);
      }
    };

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        void syncFromRemote();
      }
    }, REMOTE_SYNC_INTERVAL_MS);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mounted, syncFromRemote, userId]);

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
    
    if (userId !== "default") {
      void deleteRemoteHoldingState(userId, id).catch((error) => {
        console.error("Failed to delete holding from Supabase:", error);
      });
    }
  }, [userId]);

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
