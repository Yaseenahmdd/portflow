/**
 * Alpha Vantage API helper — used for Indian stocks/ETFs on NSE.
 * Requires ALPHA_VANTAGE_API_KEY env var.
 * Free tier: 25 requests/day, 5/min.
 */

export interface AlphaVantageQuote {
  symbol: string;
  price: number;
  previousClose: number;
  changePercent: string;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchAlphaVantageQuote(symbol: string): Promise<AlphaVantageQuote | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    console.warn('ALPHA_VANTAGE_API_KEY not set, skipping Alpha Vantage fetch');
    return null;
  }

  try {
    const params = new URLSearchParams({
      function: 'GLOBAL_QUOTE',
      symbol,
      apikey: apiKey,
    });

    const res = await fetch(`https://www.alphavantage.co/query?${params}`, {
      next: { revalidate: 1800 }, // Cache 30 min
    });
    if (!res.ok) throw new Error(`Alpha Vantage error: ${res.status}`);
    const data = await res.json();

    const gq = data['Global Quote'];
    if (!gq || !gq['05. price']) return null;

    return {
      symbol,
      price: parseFloat(gq['05. price']),
      previousClose: parseFloat(gq['08. previous close']),
      changePercent: gq['10. change percent'],
    };
  } catch (err) {
    console.error(`Alpha Vantage: failed to fetch ${symbol}:`, err);
    return null;
  }
}

/**
 * Fetch multiple Indian stock quotes with rate limiting (1s between calls).
 */
export async function fetchAlphaVantageMultiple(
  symbols: string[]
): Promise<Record<string, AlphaVantageQuote>> {
  const results: Record<string, AlphaVantageQuote> = {};

  for (let i = 0; i < symbols.length; i++) {
    if (i > 0) await delay(1200); // Respect rate limit
    const quote = await fetchAlphaVantageQuote(symbols[i]);
    if (quote) {
      // Use the raw ticker (without NSE: prefix) as key
      const key = symbols[i].replace('NSE:', '');
      results[key] = quote;
    }
  }

  return results;
}
