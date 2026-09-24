/**
 * Yahoo Finance API helper for Indian and US stocks/ETFs.
 * Replaces Alpha Vantage due to 25 requests/day limit.
 * No API key required.
 */

export interface StockQuote {
  symbol: string;
  price: number;
  previousClose: number;
  changePercent: string;
  priceSession?: "pre-market";
  priceAsOf?: string;
}

const REQUEST_TIMEOUT_MS = 8_000;

const YAHOO_SYMBOL_ALIASES: Record<string, string> = {
  MAM150ETF: "MIDCAPETF",
};

function toYahooSymbol(symbol: string) {
  const normalizedSymbol = symbol.replace("NSE:", "");
  const yahooSymbol = YAHOO_SYMBOL_ALIASES[normalizedSymbol] || normalizedSymbol;
  return symbol.startsWith("NSE:") ? `${yahooSymbol}.NS` : yahooSymbol;
}

interface YahooChartResult {
  meta?: {
    regularMarketPrice?: number;
    regularMarketTime?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    currentTradingPeriod?: { pre?: { start?: number; end?: number } };
  };
  timestamp?: number[];
  indicators?: { quote?: Array<{ close?: Array<number | null> }> };
}

export function selectYahooQuote(result: YahooChartResult, symbol: string, nowSeconds = Math.floor(Date.now() / 1000)): StockQuote | null {
  const meta = result.meta;
  if (!meta) return null;

  const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? 0;
  const pre = meta.currentTradingPeriod?.pre;
  const isUsSymbol = !symbol.startsWith("NSE:");
  let price = meta.regularMarketPrice;
  let priceSession: StockQuote["priceSession"];
  let priceAsOf = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : undefined;

  if (isUsSymbol && pre?.start && pre?.end && nowSeconds >= pre.start && nowSeconds < pre.end) {
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const timestamps = result.timestamp ?? [];
    for (let index = timestamps.length - 1; index >= 0; index -= 1) {
      const timestamp = timestamps[index];
      const close = closes[index];
      if (timestamp >= pre.start && timestamp <= nowSeconds && typeof close === "number" && Number.isFinite(close) && close > 0) {
        price = close;
        priceSession = "pre-market";
        priceAsOf = new Date(timestamp * 1000).toISOString();
        break;
      }
    }
  }

  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null;

  return {
    symbol: symbol.replace("NSE:", ""),
    price,
    previousClose,
    changePercent: previousClose > 0 ? `${(((price - previousClose) / previousClose) * 100).toFixed(2)}%` : "0.00%",
    priceSession,
    priceAsOf,
  };
}

export async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const yahooSymbol = toYahooSymbol(symbol);

    const isUsSymbol = !symbol.startsWith("NSE:");
    const query = isUsSymbol ? "interval=1m&range=1d&includePrePost=true" : "interval=1d&range=1d";
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance error: ${res.status}`);
    }

    const data = await res.json();
    return selectYahooQuote(data?.chart?.result?.[0] ?? {}, symbol);
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
