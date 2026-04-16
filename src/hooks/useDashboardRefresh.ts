"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Holding } from "@/lib/constants";
import { registerDashboardRefreshHandler } from "@/lib/dashboard/refresh-controller";
import { refreshDashboardPrices, type RefreshFailure } from "@/lib/dashboard/refresh";
import { threshold as hapticThreshold, success as hapticSuccess, destructive as hapticError } from "@/lib/haptics";

const AUTO_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const MAX_PULL_DISTANCE = 96;
const PULL_THRESHOLD = 72;

interface UseDashboardRefreshOptions {
  mounted: boolean;
  holdings: Holding[];
  setHoldings: Dispatch<SetStateAction<Holding[]>>;
  setInrToAedRate: Dispatch<SetStateAction<number>>;
  setFxUpdatedAt: Dispatch<SetStateAction<string | null>>;
}

export function useDashboardRefresh({
  mounted,
  holdings,
  setHoldings,
  setInrToAedRate,
  setFxUpdatedAt,
}: UseDashboardRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshFailures, setRefreshFailures] = useState<RefreshFailure[]>([]);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const holdingsRef = useRef(holdings);
  const isRefreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const crossedThresholdRef = useRef(false);

  holdingsRef.current = holdings;
  isRefreshingRef.current = isRefreshing;
  pullDistanceRef.current = pullDistance;

  const refreshPrices = useCallback(async () => {
    if (isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    try {
      const refreshedState = await refreshDashboardPrices(holdingsRef.current);
      setHoldings(refreshedState.holdings);
      setRefreshFailures(refreshedState.failures);
      setRefreshError(null);
      hapticSuccess();

      if (refreshedState.inrToAedRate) {
        setInrToAedRate(refreshedState.inrToAedRate);
      }

      if (refreshedState.fxUpdatedAt) {
        setFxUpdatedAt(refreshedState.fxUpdatedAt);
      }
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Refresh failed");
      hapticError();
      console.error("Price refresh error:", error);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      setIsPullRefreshing(false);
    }
  }, [setFxUpdatedAt, setHoldings, setInrToAedRate]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    return registerDashboardRefreshHandler(() => {
      void refreshPrices();
    });
  }, [mounted, refreshPrices]);

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
      crossedThresholdRef.current = false;
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

      // Haptic feedback when crossing the release threshold
      if (damped >= PULL_THRESHOLD && !crossedThresholdRef.current) {
        crossedThresholdRef.current = true;
        hapticThreshold();
      } else if (damped < PULL_THRESHOLD) {
        crossedThresholdRef.current = false;
      }

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
    refreshFailures,
    refreshError,
    refreshPrices,
  };
}
