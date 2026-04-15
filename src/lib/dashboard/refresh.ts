import { computeInrToAed, type ExchangeRates } from "@/lib/api/frankfurter";
import { type Holding, type NormalizedPrice, type RefreshScope } from "@/lib/constants";
import { normalizeHoldings } from "@/lib/holdings-normalize";
import { convertPriceBetweenCurrencies } from "@/lib/utils";

interface PriceResult {
  source: string;
  success: boolean;
  data?: unknown;
  error?: string;
  lastUpdated?: string;
  stale?: boolean;
}

export interface RefreshFailure {
  source: string;
  error: string;
}

interface RefreshResponse {
  success: boolean;
  results?: PriceResult[];
  error?: string;
}

interface RefreshOptions {
  scopes?: RefreshScope[];
  excludeTickers?: string[];
  inrToAedRate: number;
  forceRefresh?: boolean;
}

function normalizeHoldingTicker(ticker: string) {
  return ticker.trim().toUpperCase().replace(/^NSE:/, "");
}

function applyNormalizedPrices(
  holdings: Holding[],
  prices: NormalizedPrice[],
  source: PriceResult["source"],
  inrToAedRate: number
) {
  if (!prices.length) {
    return holdings;
  }

  return holdings.map((holding) => {
    const match = prices.find((price) => {
      if (source === "indian-mf") {
        return holding.schemeCode === price.symbol;
      }

      return normalizeHoldingTicker(holding.ticker) === price.symbol;
    });

    if (!match) {
      return holding;
    }

    return {
      ...holding,
      currentPrice: convertPriceBetweenCurrencies(match.price, match.currency, holding.currency, inrToAedRate),
      lastPriceUpdate: match.timestamp,
    };
  });
}

function applyRefreshResults(holdings: Holding[], results: PriceResult[], initialInrToAedRate: number) {
  let updated = [...holdings];
  let inrToAedRate = initialInrToAedRate;
  let fxUpdatedAt: string | undefined;

  for (const result of results) {
    if (!result.success || !result.data) {
      continue;
    }

    if (result.source === "currency") {
      const exchangeRates = (result.data as { rates?: ExchangeRates }).rates || null;
      inrToAedRate = computeInrToAed(exchangeRates);
      fxUpdatedAt = exchangeRates?.fetchedAt || result.lastUpdated;
      continue;
    }

    const prices = (result.data as { prices?: NormalizedPrice[] }).prices || [];
    updated = applyNormalizedPrices(updated, prices, result.source, inrToAedRate);
  }

  return { holdings: updated, inrToAedRate, fxUpdatedAt };
}

export async function refreshDashboardPrices(holdings: Holding[], options: RefreshOptions) {
  const { normalized: normalizedHoldings } = normalizeHoldings(holdings);
  const response = await fetch("/api/prices/refresh-all", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      holdings: normalizedHoldings,
      scopes: options.scopes,
      excludeTickers: options.excludeTickers,
      forceRefresh: options.forceRefresh,
    }),
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Price refresh returned an unexpected response.");
  }

  const data = (await response.json()) as RefreshResponse;
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Refresh failed");
  }

  const results = data.results || [];
  const failures: RefreshFailure[] = results
    .filter((result) => !result.success)
    .map((result) => ({
      source: result.source,
      error: result.error || "Refresh source failed",
    }));

  return {
    ...applyRefreshResults(normalizedHoldings, results, options.inrToAedRate),
    failures,
  };
}
