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

const YAHOO_SYMBOL_ALIASES: Record<string, string> = {
  MAM150ETF: "MIDCAPETF",
};

function toYahooSymbol(symbol: string) {
  const normalizedSymbol = symbol.replace("NSE:", "");
  const yahooSymbol = YAHOO_SYMBOL_ALIASES[normalizedSymbol] || normalizedSymbol;
  return symbol.startsWith("NSE:") ? `${yahooSymbol}.NS` : yahooSymbol;
}

export async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const yahooSymbol = toYahooSymbol(symbol);

    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance error: ${res.status}`);
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result?.meta) {
      return null;
    }

    const price = result.meta.regularMarketPrice;
    const previousClose = result.meta.chartPreviousClose ?? result.meta.previousClose ?? 0;
    const changePercent =
      previousClose > 0 ? `${(((price - previousClose) / previousClose) * 100).toFixed(2)}%` : "0.00%";

    return {
      symbol: symbol.replace("NSE:", ""),
      price: price || 0,
      previousClose,
      changePercent,
    };
  } catch (err) {
    console.error(`Yahoo Finance: failed to fetch ${symbol}:`, err);
    return null;
  }
}

/**
 * Fetch multiple stock/ETF quotes from Yahoo Finance without an API key.
 */
export async function fetchAlphaVantageMultiple(
  symbols: string[]
): Promise<Record<string, StockQuote>> {
  const results: Record<string, StockQuote> = {};

  const promises = symbols.map(async (symbol) => {
    const quote = await fetchStockQuote(symbol);
    if (quote) {
      results[symbol.replace("NSE:", "")] = quote;
    }
  });

  await Promise.all(promises);
  return results;
}
