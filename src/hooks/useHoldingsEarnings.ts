"use client";

import { useEffect, useMemo, useState } from "react";
import type { EarningsDetails, EarningsSummary } from "@/lib/api/nasdaq-earnings";
import type { Headline } from "@/lib/api/yahoo-news";
import type { ComputedHolding } from "@/lib/constants";
import { getEarningsCoverage, sortByNextEarnings } from "@/lib/earnings";

export interface EarningsFreshness {
  fetchedAt: string;
  lastError: string | null;
}

interface EarningsPayload {
  data: Record<string, EarningsSummary>;
  meta: Record<string, EarningsFreshness>;
}

interface EarningsState extends EarningsPayload {
  key: string;
  error: string | null;
}

// Earnings move slowly, so keep results across dashboard tab switches.
const sessionCache = new Map<string, EarningsPayload>();
const EMPTY: EarningsPayload = { data: {}, meta: {} };

export function useHoldingsEarnings(symbols: string[]) {
  const key = [...symbols].sort().join(",");
  const [state, setState] = useState<EarningsState>(() => ({
    key,
    ...(sessionCache.get(key) ?? EMPTY),
    error: null,
  }));

  useEffect(() => {
    if (!key || sessionCache.has(key)) return;
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch(`/api/earnings?symbols=${encodeURIComponent(key)}`, { signal: controller.signal });
        const body = await res.json();
        if (!res.ok || !body?.success) throw new Error(body?.error || "Failed to fetch earnings");
        const payload: EarningsPayload = { data: body.data ?? {}, meta: body.meta ?? {} };
        sessionCache.set(key, payload);
        setState({ key, ...payload, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({ key, ...EMPTY, error: error instanceof Error ? error.message : "Failed to fetch earnings" });
      }
    }

    load();
    return () => controller.abort();
  }, [key]);

  const cached = sessionCache.get(key);
  if (cached) return { ...cached, loading: false, error: null };
  if (!key) return { ...EMPTY, loading: false, error: null };
  if (state.key !== key) return { ...EMPTY, loading: true, error: null };
  return { data: state.data, meta: state.meta, loading: !state.error, error: state.error };
}

export function useEarningsRows(holdings: ComputedHolding[], totalValueAed: number) {
  const coverage = useMemo(() => getEarningsCoverage(holdings, totalValueAed), [holdings, totalValueAed]);
  const symbols = useMemo(() => coverage.positions.map((position) => position.symbol), [coverage]);
  const { data, meta, loading, error } = useHoldingsEarnings(symbols);
  const rows = useMemo(
    () => sortByNextEarnings(coverage.positions.map((position) => ({ ...position, summary: data[position.symbol] ?? null }))),
    [coverage, data]
  );
  // The oldest snapshot is the honest "updated" time for the whole list.
  const updatedAt = useMemo(
    () => Object.values(meta).map((entry) => entry.fetchedAt).sort()[0] ?? null,
    [meta]
  );

  return { rows, uncovered: coverage.uncovered, loading, error, updatedAt };
}

export interface EarningsDetailsData {
  details: EarningsDetails;
  headlines: Headline[];
  price: number | null;
}

const detailsCache = new Map<string, EarningsDetailsData>();
const detailsInflight = new Map<string, Promise<EarningsDetailsData>>();

function loadEarningsDetails(symbol: string): Promise<EarningsDetailsData> {
  const cached = detailsCache.get(symbol);
  if (cached) return Promise.resolve(cached);
  let request = detailsInflight.get(symbol);
  if (!request) {
    request = fetch(`/api/earnings/details?symbol=${encodeURIComponent(symbol)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body?.success) throw new Error(body?.error || "Failed to fetch earnings details");
        detailsCache.set(symbol, body.data);
        return body.data as EarningsDetailsData;
      })
      .finally(() => detailsInflight.delete(symbol));
    detailsInflight.set(symbol, request);
  }
  return request;
}

export function useEarningsDetails(symbol: string) {
  const [state, setState] = useState<{ symbol: string; data: EarningsDetailsData | null; error: string | null }>(() => ({
    symbol,
    data: detailsCache.get(symbol) ?? null,
    error: null,
  }));

  useEffect(() => {
    if (detailsCache.has(symbol)) return;
    let cancelled = false;
    loadEarningsDetails(symbol).then(
      (data) => !cancelled && setState({ symbol, data, error: null }),
      (error) =>
        !cancelled &&
        setState({ symbol, data: null, error: error instanceof Error ? error.message : "Failed to fetch earnings details" })
    );
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const cached = detailsCache.get(symbol);
  if (cached) return { data: cached, loading: false, error: null };
  if (state.symbol !== symbol) return { data: null, loading: true, error: null };
  return { data: state.data, loading: !state.error && !state.data, error: state.error };
}
