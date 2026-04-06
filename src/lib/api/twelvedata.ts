/**
 * Twelve Data API helper — used for US ETFs and UAE stocks.
 * Requires TWELVE_DATA_API_KEY env var.
 * Supports batching up to 8 symbols in one call.
 */

export interface TwelveDataQuote {
  symbol: string;
  name: string;
  close: string;
  previous_close: string;
  change: string;
  percent_change: string;
  timestamp: number;
}

export async function fetchTwelveDataQuotes(
  symbols: string[],
  exchange?: string
): Promise<Record<string, TwelveDataQuote>> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    console.warn('TWELVE_DATA_API_KEY not set, skipping Twelve Data fetch');
    return {};
  }

  const symbolsStr = symbols.join(',');
  const params = new URLSearchParams({
    symbol: symbolsStr,
    apikey: apiKey,
  });
  if (exchange) {
    params.set('exchange', exchange);
  }

  try {
    const res = await fetch(`https://api.twelvedata.com/quote?${params}`, {
      next: { revalidate: 900 }, // Cache 15 min
    });
    if (!res.ok) throw new Error(`Twelve Data error: ${res.status}`);
    const data = await res.json();

    // Single symbol returns the object directly; multiple returns keyed by symbol
    if (symbols.length === 1) {
      if (data.code && data.code !== 200) return {};
      return { [symbols[0]]: data as TwelveDataQuote };
    }

    // Filter out any errored symbols
    const results: Record<string, TwelveDataQuote> = {};
    for (const [key, val] of Object.entries(data)) {
      const v = val as Record<string, unknown>;
      if (v && !v.code) {
        results[key] = v as unknown as TwelveDataQuote;
      }
    }
    return results;
  } catch (err) {
    console.error('Failed to fetch from Twelve Data:', err);
    return {};
  }
}
