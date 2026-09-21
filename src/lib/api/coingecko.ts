/**
 * CoinGecko API helper — free, no key required.
 * Used for crypto prices (BTC, ETH, etc.).
 */

export interface CryptoPrice {
  id: string;
  usd: number;
  aed: number;
  usd_24h_change: number;
  previousCloseUsd?: number;
  previousCloseAed?: number;
}

const REQUEST_TIMEOUT_MS = 8_000;

type HistoricalPricePoint = [timestamp: number, price: number];

/** Select the price nearest to the start of the current UTC day. */
export function selectPreviousUtcClose(
  prices: HistoricalPricePoint[],
  now = new Date()
) {
  const utcDayStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const validPrices = prices.filter(
    ([timestamp, price]) => Number.isFinite(timestamp) && Number.isFinite(price) && price > 0
  );

  if (!validPrices.length) return undefined;

  const closest = validPrices.reduce((best, point) =>
    Math.abs(point[0] - utcDayStart) < Math.abs(best[0] - utcDayStart) ? point : best
  );

  // A two-day chart should contain an hourly point near 00:00 UTC. Reject
  // anything farther away so a stale value never masquerades as yesterday's close.
  return Math.abs(closest[0] - utcDayStart) <= 2 * 60 * 60 * 1000
    ? closest[1]
    : undefined;
}

async function fetchPreviousUtcCloseUsd(id: string) {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=2`,
      {
        next: { revalidate: 60 * 60 },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko history error: ${response.status}`);
    }

    const data = await response.json();
    return selectPreviousUtcClose(Array.isArray(data?.prices) ? data.prices : []);
  } catch (error) {
    console.warn(`CoinGecko: failed to fetch previous UTC close for ${id}:`, error);
    return undefined;
  }
}

export async function fetchCryptoPrices(
  ids: string[]
): Promise<Record<string, CryptoPrice>> {
  try {
    const idsStr = ids.join(',');
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${idsStr}&vs_currencies=usd,aed&include_24hr_change=true`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
    const data = await res.json();

    const previousCloses = new Map(
      await Promise.all(
        ids.map(async (id) => [id, await fetchPreviousUtcCloseUsd(id)] as const)
      )
    );
    const results: Record<string, CryptoPrice> = {};
    for (const [id, val] of Object.entries(data)) {
      const v = val as Record<string, number>;
      const usd = v.usd || 0;
      const aed = v.aed || 0;
      const previousCloseUsd = previousCloses.get(id);
      const usdToAed = usd > 0 ? aed / usd : 0;
      results[id] = {
        id,
        usd,
        aed,
        usd_24h_change: v.usd_24h_change || 0,
        previousCloseUsd,
        previousCloseAed:
          previousCloseUsd && usdToAed > 0
            ? previousCloseUsd * usdToAed
            : undefined,
      };
    }

    return results;
  } catch (err) {
    console.error('CoinGecko: failed to fetch crypto prices:', err);
    return {};
  }
}
