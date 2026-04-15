"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { registerDashboardRefreshHandler } from "@/lib/dashboard/refresh-controller";
import { refreshDashboardPrices, type RefreshFailure } from "@/lib/dashboard/refresh";
import {
  CRYPTO_POLL_INTERVAL_MS,
  REFERENCE_DATA_POLL_INTERVAL_MS,
  STOCK_POLL_INTERVAL_MS,
  type Holding,
  type RefreshScope,
} from "@/lib/constants";

const MAX_PULL_DISTANCE = 96;
const PULL_THRESHOLD = 72;

interface UseDashboardRefreshOptions {
  mounted: boolean;
  holdings: Holding[];
  setHoldings: Dispatch<SetStateAction<Holding[]>>;
  inrToAedRate: number;
  setInrToAedRate: Dispatch<SetStateAction<number>>;
  setFxUpdatedAt: Dispatch<SetStateAction<string | null>>;
}

interface RefreshCallOptions {
  scopes?: RefreshScope[];
  silent?: boolean;
  excludeTickers?: string[];
  forceRefresh?: boolean;
}

export function useDashboardRefresh({
  mounted,
  holdings,
  setHoldings,
  inrToAedRate,
  setInrToAedRate,
  setFxUpdatedAt,
}: UseDashboardRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshFailures, setRefreshFailures] = useState<RefreshFailure[]>([]);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const holdingsRef = useRef(holdings);
  const inrToAedRateRef = useRef(inrToAedRate);
  const isRefreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const initialRefreshCompletedRef = useRef(false);

  holdingsRef.current = holdings;
  inrToAedRateRef.current = inrToAedRate;
  isRefreshingRef.current = isRefreshing;
  pullDistanceRef.current = pullDistance;

  const refreshPrices = useCallback(
    async (options?: RefreshCallOptions) => {
      const silent = options?.silent ?? false;

      if (!silent && isRefreshingRef.current) {
        return;
      }

      if (!silent) {
        isRefreshingRef.current = true;
        setIsRefreshing(true);
      }

      try {
        const refreshedState = await refreshDashboardPrices(holdingsRef.current, {
          scopes: options?.scopes,
          excludeTickers: options?.excludeTickers,
          inrToAedRate: inrToAedRateRef.current,
          forceRefresh: options?.forceRefresh,
        });

        setHoldings(refreshedState.holdings);
        setRefreshFailures(refreshedState.failures);
        setRefreshError(null);

        if (refreshedState.inrToAedRate) {
          setInrToAedRate(refreshedState.inrToAedRate);
        }

        if (refreshedState.fxUpdatedAt) {
          setFxUpdatedAt(refreshedState.fxUpdatedAt);
        }
      } catch (error) {
        setRefreshError(error instanceof Error ? error.message : "Refresh failed");
        console.error("Price refresh error:", error);
      } finally {
        if (!silent) {
          isRefreshingRef.current = false;
          setIsRefreshing(false);
          setIsPullRefreshing(false);
        }
      }
    },
    [setFxUpdatedAt, setHoldings, setInrToAedRate]
  );

  useEffect(() => {
    if (!mounted) {
      return;
    }

    return registerDashboardRefreshHandler((request) => {
      void refreshPrices({
        forceRefresh: request?.forceRefresh,
      });
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
    if (!mounted || initialRefreshCompletedRef.current) {
      return;
    }

    initialRefreshCompletedRef.current = true;
    void refreshPrices({
      scopes: ["crypto", "stocks", "fx", "mutualFunds"],
    });
  }, [mounted, refreshPrices]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const intervalConfigs: Array<{ interval: number; run: () => void }> = [
      {
        interval: CRYPTO_POLL_INTERVAL_MS,
        run: () =>
          void refreshPrices({
            scopes: ["crypto"],
            silent: true,
            excludeTickers: ["BTC"],
          }),
      },
      {
        interval: STOCK_POLL_INTERVAL_MS,
        run: () =>
          void refreshPrices({
            scopes: ["stocks"],
            silent: true,
          }),
      },
      {
        interval: REFERENCE_DATA_POLL_INTERVAL_MS,
        run: () =>
          void refreshPrices({
            scopes: ["fx", "mutualFunds"],
            silent: true,
          }),
      },
    ];

    const intervalIds = intervalConfigs.map(({ interval, run }) => window.setInterval(() => {
      if (!document.hidden) {
        run();
      }
    }, interval));

    return () => {
      intervalIds.forEach((id) => window.clearInterval(id));
    };
  }, [mounted, refreshPrices]);

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
    refreshFailures,
    refreshError,
    refreshPrices,
  };
}
