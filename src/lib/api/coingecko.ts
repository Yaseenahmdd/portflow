/**
 * CoinGecko API helper — free, no key required.
 * Used for crypto prices (BTC, ETH, etc.).
 */

import { getCachedOrFetch, type CachedFetchResult } from "@/lib/api/cache";
import { CRYPTO_CACHE_TTL_MS } from "@/lib/constants";

export interface CryptoPrice {
  id: string;
  usd: number;
  aed: number;
  usd_24h_change: number;
}

export async function fetchCryptoPrices(
  ids: string[],
  options?: { forceRefresh?: boolean }
) : Promise<CachedFetchResult<Record<string, CryptoPrice>>> {
  const cacheKey = `coingecko:${[...ids].sort().join(",")}`;

  return getCachedOrFetch({
    key: cacheKey,
    ttlMs: CRYPTO_CACHE_TTL_MS,
    source: "coingecko",
    forceRefresh: options?.forceRefresh,
    loader: async () => {
      const idsStr = ids.join(",");
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${idsStr}&vs_currencies=usd,aed&include_24hr_change=true`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        throw new Error(`CoinGecko error: ${res.status}`);
      }

      const data = await res.json();
      const results: Record<string, CryptoPrice> = {};

      for (const [id, val] of Object.entries(data)) {
        const v = val as Record<string, number>;
        results[id] = {
          id,
          usd: v.usd || 0,
          aed: v.aed || 0,
          usd_24h_change: v.usd_24h_change || 0,
        };
      }

      if (!Object.keys(results).length && ids.length) {
        throw new Error("CoinGecko returned no prices");
      }

      return results;
    },
  });
}
