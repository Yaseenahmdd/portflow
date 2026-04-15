import https from "https";
import { getCachedOrFetch, type CachedFetchResult } from "@/lib/api/cache";
import { STOCK_CACHE_TTL_MS } from "@/lib/constants";

export interface DfmQuote {
  id: string;
  lastradeprice: number;
  previousclosingprice: number;
  changepercentage: number;
  lastradetime: string | null;
}

export async function fetchDfmQuotes(
  symbols: string[],
  options?: { forceRefresh?: boolean }
): Promise<CachedFetchResult<Record<string, DfmQuote>>> {
  const cacheKey = `dfm:${[...symbols].sort().join(",")}`;

  return getCachedOrFetch({
    key: cacheKey,
    ttlMs: STOCK_CACHE_TTL_MS,
    source: "dfm",
    forceRefresh: options?.forceRefresh,
    loader: async () => {
      const data = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        const req = https.request(
          "https://api2.dfm.ae/mw/v1/stocks",
          {
            method: "GET",
            rejectUnauthorized: false,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
          },
          (res) => {
            if (res.statusCode !== 200) {
              reject(new Error(`DFM error: ${res.statusCode}`));
              return;
            }
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => {
              try {
                resolve(JSON.parse(body));
              } catch (err) {
                reject(err);
              }
            });
          }
        );
        req.on("error", reject);
        req.end();
      });

      const wanted = new Set(symbols);
      const results: Record<string, DfmQuote> = {};

      for (const row of data) {
        const id = String(row.id || "");
        if (!wanted.has(id)) continue;

        results[id] = {
          id,
          lastradeprice: Number(row.lastradeprice || 0),
          previousclosingprice: Number(row.previousclosingprice || 0),
          changepercentage: Number(row.changepercentage || 0),
          lastradetime: typeof row.lastraded === "string" ? row.lastraded : null,
        };
      }

      if (!Object.keys(results).length && symbols.length) {
        throw new Error("DFM returned no prices");
      }

      return results;
    },
  });
}
