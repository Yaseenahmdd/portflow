/**
 * Frankfurter API — free, no key required.
 * Used for currency exchange rates.
 */

import { getCachedOrFetch, type CachedFetchResult } from "@/lib/api/cache";
import { FX_CACHE_TTL_MS } from "@/lib/constants";

export interface ExchangeRates {
  base: string;
  date: string;
  rates: Record<string, number>;
  fetchedAt?: string;
}

export async function fetchExchangeRates(
  options?: { forceRefresh?: boolean }
): Promise<CachedFetchResult<ExchangeRates>> {
  return getCachedOrFetch({
    key: "frankfurter:usd-inr",
    ttlMs: FX_CACHE_TTL_MS,
    source: "frankfurter",
    forceRefresh: options?.forceRefresh,
    loader: async () => {
      const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=INR", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Frankfurter error: ${res.status}`);
      }

      const data: ExchangeRates = await res.json();
      const inrPerUsd = data.rates.INR;
      const inrPerAed = inrPerUsd / 3.6725;

      return {
        base: "AED",
        date: data.date,
        rates: { INR: inrPerAed },
        fetchedAt: new Date().toISOString(),
      };
    },
  });
}

/**
 * Compute INR → AED rate from Frankfurter response.
 * Frankfurter gives AED → INR, so we invert.
 */
export function computeInrToAed(rates: ExchangeRates | null): number {
  if (!rates?.rates?.INR) return 0.044; // fallback
  return 1 / rates.rates.INR;
}
