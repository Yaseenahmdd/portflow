/**
 * Yahoo Finance API helper — used for Indian stocks/ETFs on NSE.
 * Replaces Alpha Vantage due to 25 requests/day limit.
 * No API key required.
 */

export interface StockQuote {
  symbol: string;
  price: number;
  previousClose: number;
  changePercent: string;
}

export async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    // Convert symbol like NSE:GOLDBEES to GOLDBEES.NS for Yahoo Finance
    const yfSymbol = symbol.replace('NSE:', '') + '.NS';
    
    // Using Yahoo Finance's unauthenticated v8 chart API
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?interval=1d&range=1d`, {
      next: { revalidate: 300 }, // Cache 5 min
    });
    
    if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`);
    const data = await res.json();

    const result = data?.chart?.result?.[0];
    if (!result?.meta) return null;

    const price = result.meta.regularMarketPrice;
    const previousClose = result.meta.chartPreviousClose;
    
    let changePercent = '0.00%';
    if (price && previousClose) {
      changePercent = (((price - previousClose) / previousClose) * 100).toFixed(2) + '%';
    }

    return {
      symbol,
      price: price || 0,
      previousClose: previousClose || 0,
      changePercent,
    };
  } catch (err) {
    console.error(`Yahoo Finance: failed to fetch ${symbol}:`, err);
    return null;
  }
}

/**
 * Fetch multiple Indian stock quotes
 */
export async function fetchAlphaVantageMultiple(
  symbols: string[]
): Promise<Record<string, StockQuote>> {
  const results: Record<string, StockQuote> = {};

  // Yahoo Finance doesn't have the severe 5 req/min limits like AV, so we can fetch concurrently
  const promises = symbols.map(async (sym) => {
    const quote = await fetchStockQuote(sym);
    if (quote) {
      const key = sym.replace('NSE:', '');
      results[key] = quote;
    }
  });

  await Promise.all(promises);
  return results;
}
