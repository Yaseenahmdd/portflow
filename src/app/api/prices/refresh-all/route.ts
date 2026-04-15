import { fetchAlphaVantageMultiple } from "@/lib/api/alphavantage";
import { fetchCryptoPrices } from "@/lib/api/coingecko";
import { fetchDfmQuotes } from "@/lib/api/dfm";
import { type ExchangeRates, fetchExchangeRates } from "@/lib/api/frankfurter";
import { fetchMutualFundNav } from "@/lib/api/mfapi";
import { CRYPTO_IDS, type Currency, type Holding, type NormalizedPrice, type RefreshScope } from "@/lib/constants";
import { requireAuthenticatedRouteUser } from "@/lib/supabase/route-auth";

export const dynamic = "force-dynamic";

interface PriceResult {
  source: string;
  success: boolean;
  data?: unknown;
  error?: string;
  lastUpdated?: string;
  stale?: boolean;
}

interface RefreshRequestBody {
  holdings: Holding[];
  scopes: RefreshScope[];
  excludeTickers: Set<string>;
  forceRefresh: boolean;
}

const MAX_REFRESH_HOLDINGS = 500;
const MAX_SYMBOLS_PER_SOURCE = 200;
const ALL_SCOPES: RefreshScope[] = ["crypto", "stocks", "fx", "mutualFunds"];

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function limit(values: string[]) {
  return values.slice(0, MAX_SYMBOLS_PER_SOURCE);
}

function isHoldingLike(value: unknown): value is Pick<Holding, "priceSource" | "geography" | "ticker" | "schemeCode"> {
  return typeof value === "object" && value !== null;
}

function isRefreshScope(value: unknown): value is RefreshScope {
  return value === "crypto" || value === "stocks" || value === "fx" || value === "mutualFunds";
}

function parseRefreshBody(body: unknown): RefreshRequestBody {
  if (typeof body !== "object" || body === null) {
    return {
      holdings: [],
      scopes: ALL_SCOPES,
      excludeTickers: new Set<string>(),
      forceRefresh: false,
    };
  }

  const holdings = "holdings" in body ? (body as { holdings?: unknown }).holdings : [];
  if (!Array.isArray(holdings)) {
    throw new Error("Expected holdings to be an array");
  }

  if (holdings.length > MAX_REFRESH_HOLDINGS) {
    throw new Error(`Too many holdings supplied. Maximum supported is ${MAX_REFRESH_HOLDINGS}`);
  }

  const scopesRaw = "scopes" in body ? (body as { scopes?: unknown }).scopes : undefined;
  const scopes =
    Array.isArray(scopesRaw) && scopesRaw.length
      ? scopesRaw.filter(isRefreshScope)
      : ALL_SCOPES;

  const excludeTickersRaw = "excludeTickers" in body ? (body as { excludeTickers?: unknown }).excludeTickers : undefined;
  const excludeTickers = new Set(
    Array.isArray(excludeTickersRaw)
      ? excludeTickersRaw
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim().toUpperCase())
      : []
  );

  return {
    holdings: holdings.filter(isHoldingLike) as Holding[],
    scopes,
    excludeTickers,
    forceRefresh: "forceRefresh" in body ? Boolean((body as { forceRefresh?: unknown }).forceRefresh) : false,
  };
}

function getRefreshErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  if (error instanceof SyntaxError || error.message.includes("holdings") || error.message.includes("Expected")) {
    return 400;
  }

  return 500;
}

function normalizeIndianSymbol(holding: Holding) {
  if (!holding.ticker) return "";
  return holding.ticker.startsWith("NSE:") ? holding.ticker : `NSE:${holding.ticker}`;
}

function normalizeStockPrices(
  quotes: Record<string, { price: number }>,
  currency: Currency,
  source: string,
  timestamp: string
): NormalizedPrice[] {
  return Object.entries(quotes).map(([symbol, quote]) => ({
    symbol,
    price: quote.price,
    currency,
    source,
    timestamp,
  }));
}

function normalizeCryptoPrices(
  quotes: Record<string, { usd: number }>,
  timestamp: string
): NormalizedPrice[] {
  const tickerById = Object.entries(CRYPTO_IDS).reduce<Record<string, string>>((accumulator, [ticker, id]) => {
    accumulator[id] = ticker;
    return accumulator;
  }, {});

  return Object.entries(quotes)
    .filter(([, quote]) => Number.isFinite(quote.usd))
    .map(([id, quote]) => ({
      symbol: tickerById[id] || id,
      price: quote.usd,
      currency: "USD",
      source: "coingecko",
      timestamp,
    }));
}

function normalizeMutualFundPrices(
  navs: Array<{ schemeCode: string; nav: number }>,
  timestamp: string
): NormalizedPrice[] {
  return navs.map((nav) => ({
    symbol: nav.schemeCode,
    price: nav.nav,
    currency: "INR",
    source: "mfapi",
    timestamp,
  }));
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedRouteUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { holdings, scopes, excludeTickers, forceRefresh } = parseRefreshBody(body);
    const refreshStocks = scopes.includes("stocks");
    const refreshCrypto = scopes.includes("crypto");
    const refreshFx = scopes.includes("fx");
    const refreshMutualFunds = scopes.includes("mutualFunds");

    const mfSchemeCodes = limit(
      unique(
        holdings
          .filter((holding) => holding.priceSource === "mfapi" && holding.schemeCode)
          .map((holding) => holding.schemeCode || "")
      )
    );

    const indianSymbols = limit(
      unique(
        holdings
          .filter(
            (holding) =>
              holding.priceSource === "alphavantage" &&
              holding.geography === "India" &&
              Boolean(holding.ticker)
          )
          .map(normalizeIndianSymbol)
      )
    );

    const usEtfSymbols = limit(
      unique(
        holdings
          .filter(
            (holding) =>
              holding.priceSource === "alphavantage" &&
              holding.geography === "US" &&
              Boolean(holding.ticker)
          )
          .map((holding) => holding.ticker)
      )
    );

    const uaeStockSymbols = limit(
      unique(
        holdings
          .filter(
            (holding) =>
              holding.priceSource === "dfm" &&
              holding.geography === "UAE" &&
              Boolean(holding.ticker)
          )
          .map((holding) => holding.ticker)
      )
    );

    const cryptoIds = limit(
      unique(
        holdings
          .filter(
            (holding) =>
              holding.priceSource === "coingecko" &&
              Boolean(holding.ticker) &&
              !excludeTickers.has(holding.ticker.trim().toUpperCase())
          )
          .map((holding) => CRYPTO_IDS[holding.ticker.trim().toUpperCase()] || "")
      )
    );

    const tasks: Array<{ source: string; promise: Promise<{ data: unknown; lastUpdated: string; stale: boolean }> }> = [];

    if (refreshFx) {
      tasks.push({
        source: "currency",
        promise: fetchExchangeRates({ forceRefresh }).then((result) => ({
          data: { rates: result.data as ExchangeRates },
          lastUpdated: result.lastUpdated,
          stale: result.stale,
        })),
      });
    }

    if (refreshMutualFunds && mfSchemeCodes.length) {
      tasks.push({
        source: "indian-mf",
        promise: fetchMutualFundNav(mfSchemeCodes, { forceRefresh }).then((result) => ({
          data: { prices: normalizeMutualFundPrices(result.data, result.lastUpdated) },
          lastUpdated: result.lastUpdated,
          stale: result.stale,
        })),
      });
    }

    if (refreshStocks && indianSymbols.length) {
      tasks.push({
        source: "indian-stocks",
        promise: fetchAlphaVantageMultiple(indianSymbols, { forceRefresh }).then((result) => ({
          data: { prices: normalizeStockPrices(result.data, "INR", result.source, result.lastUpdated) },
          lastUpdated: result.lastUpdated,
          stale: result.stale,
        })),
      });
    }

    if (refreshStocks && usEtfSymbols.length) {
      tasks.push({
        source: "us-etfs",
        promise: fetchAlphaVantageMultiple(usEtfSymbols, { forceRefresh }).then((result) => ({
          data: { prices: normalizeStockPrices(result.data, "USD", result.source, result.lastUpdated) },
          lastUpdated: result.lastUpdated,
          stale: result.stale,
        })),
      });
    }

    if (refreshStocks && uaeStockSymbols.length) {
      tasks.push({
        source: "uae-stocks",
        promise: fetchDfmQuotes(uaeStockSymbols, { forceRefresh }).then((result) => ({
          data: {
            prices: Object.entries(result.data).map(([symbol, quote]) => ({
              symbol,
              price: quote.lastradeprice,
              currency: "AED" as Currency,
              source: result.source,
              timestamp: result.lastUpdated,
            })),
          },
          lastUpdated: result.lastUpdated,
          stale: result.stale,
        })),
      });
    }

    if (refreshCrypto && cryptoIds.length) {
      tasks.push({
        source: "crypto",
        promise: fetchCryptoPrices(cryptoIds, { forceRefresh }).then((result) => ({
          data: { prices: normalizeCryptoPrices(result.data, result.lastUpdated) },
          lastUpdated: result.lastUpdated,
          stale: result.stale,
        })),
      });
    }

    const settledResults = await Promise.allSettled(tasks.map((task) => task.promise));
    const results: PriceResult[] = settledResults.map((result, index) => {
      const source = tasks[index].source;

      if (result.status === "fulfilled") {
        return {
          source,
          success: true,
          data: result.value.data,
          lastUpdated: result.value.lastUpdated,
          stale: result.value.stale,
        };
      }

      return {
        source,
        success: false,
        error: result.reason instanceof Error ? result.reason.message : `Failed to fetch ${source}`,
      };
    });

    return Response.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to refresh prices",
      },
      { status: getRefreshErrorStatus(error) }
    );
  }
}
