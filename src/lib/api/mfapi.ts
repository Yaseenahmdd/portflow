/**
 * Fetch latest NAV from MFAPI.in (no API key required).
 * Returns { schemeCode, nav, date } for each requested scheme.
 */

import { getCachedOrFetch, type CachedFetchResult } from "@/lib/api/cache";
import { MUTUAL_FUND_CACHE_TTL_MS } from "@/lib/constants";

export interface MFNavResult {
  schemeCode: string;
  schemeName: string;
  nav: number;
  date: string;
}

export async function fetchMutualFundNav(
  schemeCodes: string[],
  options?: { forceRefresh?: boolean }
): Promise<CachedFetchResult<MFNavResult[]>> {
  const cacheKey = `mfapi:${[...schemeCodes].sort().join(",")}`;

  return getCachedOrFetch({
    key: cacheKey,
    ttlMs: MUTUAL_FUND_CACHE_TTL_MS,
    source: "mfapi",
    forceRefresh: options?.forceRefresh,
    loader: async () => {
      const results: MFNavResult[] = [];

      const fetches = schemeCodes.map(async (code) => {
        const res = await fetch(`https://api.mfapi.in/mf/${code}/latest`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`MFAPI error: ${res.status}`);
        }

        const data = await res.json();

        if (data?.data?.[0]) {
          results.push({
            schemeCode: code,
            schemeName: data.meta?.scheme_name || "",
            nav: parseFloat(data.data[0].nav),
            date: data.data[0].date,
          });
        }
      });

      await Promise.allSettled(fetches);

      if (!results.length && schemeCodes.length) {
        throw new Error("MFAPI returned no NAV data");
      }

      return results;
    },
  });
}
