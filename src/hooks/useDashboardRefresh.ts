"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Holding } from "@/lib/constants";
import { refreshDashboardPrices } from "@/lib/dashboard/refresh";

const AUTO_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const MAX_PULL_DISTANCE = 96;
const PULL_THRESHOLD = 72;

interface UseDashboardRefreshOptions {
  holdings: Holding[];
  setHoldings: Dispatch<SetStateAction<Holding[]>>;
  setInrToAedRate: Dispatch<SetStateAction<number>>;
}

export function useDashboardRefresh({
  holdings,
  setHoldings,
  setInrToAedRate,
}: UseDashboardRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const holdingsRef = useRef(holdings);
  const isRefreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);

  useEffect(() => {
    holdingsRef.current = holdings;
  }, [holdings]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  const refreshPrices = useCallback(async () => {
    if (isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    try {
      const refreshedState = await refreshDashboardPrices(holdingsRef.current);
      setHoldings(refreshedState.holdings);

      if (refreshedState.inrToAedRate) {
        setInrToAedRate(refreshedState.inrToAedRate);
      }
    } catch (error) {
      console.error("Price refresh error:", error);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      setIsPullRefreshing(false);
    }
  }, [setHoldings, setInrToAedRate]);

  useEffect(() => {
    function handleRefresh() {
      void refreshPrices();
    }

    window.addEventListener("portflow:refresh-prices", handleRefresh);
    return () => window.removeEventListener("portflow:refresh-prices", handleRefresh);
  }, [refreshPrices]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("portflow:refresh-state", {
        detail: { refreshing: isRefreshing },
      })
    );
  }, [isRefreshing]);

  useEffect(() => {
    let intervalId: number | null = null;

    function startInterval() {
      if (intervalId) {
        return;
      }

      intervalId = window.setInterval(() => {
        if (!document.hidden) {
          void refreshPrices();
        }
      }, AUTO_REFRESH_INTERVAL_MS);
    }

    function handleVisibility() {
      if (document.hidden) {
        if (intervalId) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
        return;
      }

      startInterval();
    }

    startInterval();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshPrices]);

  useEffect(() => {
    function handleTouchStart(event: TouchEvent) {
      if (window.scrollY > 0 || isRefreshingRef.current) {
        touchStartYRef.current = null;
        pullingRef.current = false;
        return;
      }

      touchStartYRef.current = event.touches[0]?.clientY ?? null;
      pullingRef.current = false;
    }

    function handleTouchMove(event: TouchEvent) {
      if (touchStartYRef.current === null || isRefreshingRef.current) {
        return;
      }

      const currentY = event.touches[0]?.clientY ?? touchStartYRef.current;
      const delta = currentY - touchStartYRef.current;

      if (delta <= 0 || window.scrollY > 0) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
        pullingRef.current = false;
        return;
      }

      const damped = Math.min(delta * 0.45, MAX_PULL_DISTANCE);
      pullDistanceRef.current = damped;
      pullingRef.current = true;
      setPullDistance(damped);

      if (damped > 6) {
        event.preventDefault();
      }
    }

    function handleTouchEnd() {
      if (pullingRef.current && pullDistanceRef.current >= PULL_THRESHOLD && !isRefreshingRef.current) {
        setIsPullRefreshing(true);
        void refreshPrices();
      }

      touchStartYRef.current = null;
      pullDistanceRef.current = 0;
      pullingRef.current = false;
      setPullDistance(0);
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [refreshPrices]);

  return {
    isRefreshing,
    isPullRefreshing,
    pullDistance,
    refreshPrices,
  };
}
