import type { Holding } from "@/lib/constants";
import type {
  HistoricalPriceHistories,
  HistoricalPricePoint,
} from "@/lib/historical-portfolio";

const MFAPI_BASE_URL = "https://api.mfapi.in/mf";
const YAHOO_CHART_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const DFM_HISTORY_URL = "https://api2.dfm.ae/web/widgets/v1/data";
const FRANKFURTER_RATES_URL = "https://api.frankfurter.dev/v2/rates";
const REQUEST_TIMEOUT_MS = 12_000;
const DFM_WINDOW_DAYS = 7;
const DFM_CONCURRENCY = 6;

const YAHOO_SYMBOL_ALIASES: Record<string, string> = {
  MAM150ETF: "MIDCAPETF",
};

interface HistoryFailure {
  holdingId?: string;
  assetName: string;
}

interface HistoricalPriceResult {
  histories: HistoricalPriceHistories;
  failures: HistoryFailure[];
}

interface DfmHistoryRow {
  symbol?: string;
  last_trade_price?: number;
  last_trade_price_date?: string;
}

interface DfmHistoryResponse {
  sectors?: Array<{ securities?: DfmHistoryRow[] }>;
}

interface MfHistoryResponse {
  data?: Array<{ date?: string; nav?: string | number }>;
}

interface YahooHistoryResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
}

interface CoinGeckoHistoryResponse {
  prices?: Array<[number, number]>;
}

interface FrankfurterRateRow {
  date?: string;
  base?: string;
  quote?: string;
  rate?: number;
}

function toFinitePositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toUnixSeconds(dateKey: string) {
  return Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 1000);
}

function normalizePoints(points: HistoricalPricePoint[]) {
  const priceByDate = new Map<string, number>();

  for (const point of points) {
    const price = toFinitePositiveNumber(point.price);
    if (price) priceByDate.set(point.date, price);
  }

  return [...priceByDate.entries()]
    .map(([date, price]) => ({ date, price }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function formatMfapiDate(value: string) {
  const [day, month, year] = value.split("-");
  if (!day || !month || !year) return "";
  return `${year}-${month}-${day}`;
}

function getYahooSymbol(holding: Holding) {
  const rawTicker = holding.ticker.trim().toUpperCase().replace(/^NSE:/, "");
  const ticker = YAHOO_SYMBOL_ALIASES[rawTicker] || rawTicker;

  if (holding.geography === "India" && !ticker.endsWith(".NS")) {
    return `${ticker}.NS`;
  }

  return ticker;
}

function getHoldingHistoryStartDate(holding: Holding, earliestAllowedDate: string) {
  const firstPurchaseDate = (holding.purchases || [])
    .map((purchase) => purchase.date)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort((a, b) => a.localeCompare(b))[0];

  if (!firstPurchaseDate) return earliestAllowedDate;
  const bufferedPurchaseDate = addDays(firstPurchaseDate, -7);
  return bufferedPurchaseDate > earliestAllowedDate ? bufferedPurchaseDate : earliestAllowedDate;
}

async function fetchMutualFundHistory(
  schemeCode: string,
  startDate: string,
  endDate: string
) {
  const response = await fetch(`${MFAPI_BASE_URL}/${encodeURIComponent(schemeCode)}`, {
    next: { revalidate: 6 * 60 * 60 },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`MFAPI history error: ${response.status}`);
  }

  const data = (await response.json()) as MfHistoryResponse;
  return normalizePoints(
    (data.data || []).flatMap((row) => {
      const date = formatMfapiDate(String(row.date || ""));
      const price = toFinitePositiveNumber(row.nav);
      return date >= startDate && date <= endDate && price ? [{ date, price }] : [];
    })
  );
}

async function fetchYahooHistory(holding: Holding, startDate: string, endDate: string) {
  const symbol = getYahooSymbol(holding);
  if (!symbol) return [];

  const params = new URLSearchParams({
    period1: String(toUnixSeconds(startDate)),
    period2: String(toUnixSeconds(addDays(endDate, 1))),
    interval: "1d",
    events: "history",
  });
  const response = await fetch(
    `${YAHOO_CHART_BASE_URL}/${encodeURIComponent(symbol)}?${params}`,
    {
      next: { revalidate: 6 * 60 * 60 },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error(`Yahoo history error: ${response.status}`);
  }

  const data = (await response.json()) as YahooHistoryResponse;
  const result = data.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];

  return normalizePoints(
    timestamps.flatMap((timestamp, index) => {
      const price = toFinitePositiveNumber(closes[index]);
      const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
      return price ? [{ date, price }] : [];
    })
  );
}

async function fetchBitcoinHistory(startDate: string, endDate: string) {
  const params = new URLSearchParams({
    vs_currency: "aed",
    from: String(toUnixSeconds(startDate)),
    to: String(toUnixSeconds(addDays(endDate, 1))),
  });
  const response = await fetch(`${COINGECKO_BASE_URL}/coins/bitcoin/market_chart/range?${params}`, {
    next: { revalidate: 6 * 60 * 60 },
    headers: { Accept: "application/json", "User-Agent": "Portflow/1.0" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`CoinGecko history error: ${response.status}`);
  }

  const data = (await response.json()) as CoinGeckoHistoryResponse;
  return normalizePoints(
    (data.prices || []).map(([timestamp, price]) => ({
      date: new Date(timestamp).toISOString().slice(0, 10),
      price,
    }))
  );
}

function getDfmWindows(startDate: string, endDate: string) {
  const windows: Array<{ startDate: string; endDate: string }> = [];

  for (let windowStart = startDate; windowStart <= endDate; windowStart = addDays(windowStart, DFM_WINDOW_DAYS)) {
    const windowEnd = addDays(windowStart, DFM_WINDOW_DAYS - 1);
    windows.push({
      startDate: windowStart,
      endDate: windowEnd < endDate ? windowEnd : endDate,
    });
  }

  return windows;
}

async function fetchDfmHistoryWindow(symbols: string[], startDate: string, endDate: string) {
  const body = new URLSearchParams({
    Command: "SearchCompanyPrices",
    Period: "custom",
    FromDate: startDate,
    ToDate: endDate,
    Companies: symbols.join(","),
    Language: "en",
    type: "json",
  });
  const response = await fetch(DFM_HISTORY_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`DFM history error: ${response.status}`);
  }

  const raw = await response.text();
  const data = JSON.parse(raw) as DfmHistoryResponse;
  return (data.sectors || []).flatMap((sector) => sector.securities || []);
}

async function fetchDfmHistory(symbols: string[], startDate: string, endDate: string) {
  const histories: Record<string, HistoricalPricePoint[]> = Object.fromEntries(
    symbols.map((symbol) => [symbol, []])
  );
  const windows = getDfmWindows(startDate, endDate);

  for (let index = 0; index < windows.length; index += DFM_CONCURRENCY) {
    const batch = windows.slice(index, index + DFM_CONCURRENCY);
    const results = await Promise.all(
      batch.map(({ startDate: windowStart, endDate: windowEnd }) =>
        fetchDfmHistoryWindow(symbols, windowStart, windowEnd).catch((error) => {
          console.warn(`[prices/history] DFM window ${windowStart}..${windowEnd} unavailable`, error);
          return [];
        })
      )
    );

    for (const row of results.flat()) {
      const symbol = String(row.symbol || "").toUpperCase();
      const date = String(row.last_trade_price_date || "");
      const price = toFinitePositiveNumber(row.last_trade_price);
      if (histories[symbol] && date && price) {
        histories[symbol].push({ date, price });
      }
    }
  }

  for (const symbol of symbols) {
    histories[symbol] = normalizePoints(histories[symbol]);
  }

  return histories;
}

export async function fetchHistoricalInrToAedRates(startDate: string, endDate: string) {
  const params = new URLSearchParams({
    from: startDate,
    to: endDate,
    base: "INR",
    quotes: "AED",
  });
  const response = await fetch(`${FRANKFURTER_RATES_URL}?${params}`, {
    next: { revalidate: 24 * 60 * 60 },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Frankfurter history error: ${response.status}`);
  }

  const data = (await response.json()) as FrankfurterRateRow[];
  return normalizePoints(
    data.flatMap((row) => {
      const price = toFinitePositiveNumber(row.rate);
      return row.date && row.base === "INR" && row.quote === "AED" && price
        ? [{ date: row.date, price }]
        : [];
    })
  );
}

export async function fetchHistoricalPriceHistories(
  holdings: Holding[],
  startDate: string,
  endDate: string
): Promise<HistoricalPriceResult> {
  const histories: HistoricalPriceHistories = {};
  const failures: HistoryFailure[] = [];
  const dfmHoldings = holdings.filter(
    (holding) => holding.priceSource === "dfm" && Boolean(holding.ticker.trim())
  );
  const otherHoldings = holdings.filter((holding) => holding.priceSource !== "dfm");

  const settled = await Promise.allSettled(
    otherHoldings.map(async (holding) => {
      let points: HistoricalPricePoint[] = [];
      const holdingStartDate = getHoldingHistoryStartDate(holding, startDate);

      if (holding.priceSource === "mfapi" && holding.schemeCode) {
        points = await fetchMutualFundHistory(holding.schemeCode, holdingStartDate, endDate);
      } else if (holding.priceSource === "alphavantage" && holding.ticker) {
        points = await fetchYahooHistory(holding, holdingStartDate, endDate);
      } else if (holding.priceSource === "coingecko" && holding.ticker.toUpperCase() === "BTC") {
        points = await fetchBitcoinHistory(holdingStartDate, endDate);
      }

      if (!points.length) {
        throw new Error("No historical prices returned");
      }

      return { holding, points };
    })
  );

  settled.forEach((result, index) => {
    const holding = otherHoldings[index];
    if (result.status === "fulfilled") {
      histories[holding.id] = result.value.points;
      return;
    }

    console.warn(`[prices/history] ${holding.assetName} unavailable`, result.reason);
    histories[holding.id] = [];
    failures.push({ holdingId: holding.id, assetName: holding.assetName });
  });

  if (dfmHoldings.length) {
    const dfmSymbols = [...new Set(dfmHoldings.map((holding) => holding.ticker.trim().toUpperCase()))];
    const dfmStartDate = dfmHoldings
      .map((holding) => getHoldingHistoryStartDate(holding, startDate))
      .sort((a, b) => a.localeCompare(b))[0];

    try {
      const dfmHistories = await fetchDfmHistory(dfmSymbols, dfmStartDate, endDate);

      for (const holding of dfmHoldings) {
        const points = dfmHistories[holding.ticker.trim().toUpperCase()] || [];
        histories[holding.id] = points;
        if (!points.length) failures.push({ holdingId: holding.id, assetName: holding.assetName });
      }
    } catch (error) {
      console.warn("[prices/history] DFM history unavailable", error);
      for (const holding of dfmHoldings) {
        histories[holding.id] = [];
        failures.push({ holdingId: holding.id, assetName: holding.assetName });
      }
    }
  }

  return { histories, failures };
}
