/**
 * CoinGecko API helper — free, no key required.
 * Used for crypto prices (BTC, ETH, etc.).
 */

export interface CryptoPrice {
  id: string;
  usd: number;
  aed: number;
  usd_24h_change: number;
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

    return results;
  } catch (err) {
    console.error('CoinGecko: failed to fetch crypto prices:', err);
    return {};
  }
}
