import { computeInrToAed, type ExchangeRates } from "@/lib/api/frankfurter";
import type { CryptoPrice } from "@/lib/api/coingecko";
import type { Holding } from "@/lib/constants";
import {
  buildHoldingPriceIndexes,
  getPriceIndexes,
  updateHoldingsAtIndexes,
} from "@/lib/dashboard/holding-price-index";
import { normalizeHoldings } from "@/lib/holdings-normalize";

interface PriceResult {
  source: string;
  success: boolean;
  data?: unknown;
  error?: string;
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

export function applyRefreshResults(holdings: Holding[], results: PriceResult[]) {
  const now = new Date().toISOString();
  const updated = [...holdings];
  const priceIndexes = buildHoldingPriceIndexes(holdings);
  let inrToAedRate: number | undefined;
  let fxUpdatedAt: string | undefined;

  for (const result of results) {
    if (!result.success || !result.data) {
      continue;
    }

    switch (result.source) {
      case "currency": {
        const exchangeRates = result.data as ExchangeRates | null;
        inrToAedRate = computeInrToAed(exchangeRates);
        fxUpdatedAt = exchangeRates?.fetchedAt || now;
        break;
      }

      case "indian-mf": {
        const navData = result.data as { schemeCode: string; nav: number }[];
        for (const nav of navData) {
          updateHoldingsAtIndexes(
            updated,
            getPriceIndexes(priceIndexes.mutualFunds, nav.schemeCode),
            (holding) => ({
              ...holding,
              currentPrice: nav.nav,
              previousClose: undefined,
              dayChangePercent: undefined,
              lastPriceUpdate: now,
            })
          );
        }
        break;
      }

      case "indian-stocks": {
        const quotes = result.data as Record<string, { price: number; previousClose?: number; changePercent?: string }>;
        for (const [ticker, quote] of Object.entries(quotes)) {
          updateHoldingsAtIndexes(
            updated,
            getPriceIndexes(priceIndexes.indianStocks, ticker),
            (holding) => ({
              ...holding,
              currentPrice: quote.price,
              previousClose: quote.previousClose,
              dayChangePercent: Number.parseFloat(quote.changePercent || "0"),
              lastPriceUpdate: now,
            })
          );
        }
        break;
      }

      case "us-etfs": {
        const quotes = result.data as Record<string, { price: number; previousClose?: number; changePercent?: string }>;
        for (const [symbol, quote] of Object.entries(quotes)) {
          if (quote.price !== undefined) {
            updateHoldingsAtIndexes(
              updated,
              getPriceIndexes(priceIndexes.usStocks, symbol),
              (holding) => ({
                ...holding,
                currentPrice: quote.price,
                previousClose: quote.previousClose,
                dayChangePercent: Number.parseFloat(quote.changePercent || "0"),
                lastPriceUpdate: now,
              })
            );
          }
        }
        break;
      }

      case "uae-stocks": {
        const quotes = result.data as Record<string, { lastradeprice: number; previousclosingprice?: number; changepercentage?: number }>;
        for (const [symbol, quote] of Object.entries(quotes)) {
          if (quote.lastradeprice > 0) {
            updateHoldingsAtIndexes(
              updated,
              getPriceIndexes(priceIndexes.uaeStocks, symbol),
              (holding) => ({
                ...holding,
                currentPrice: quote.lastradeprice,
                previousClose: quote.previousclosingprice,
                dayChangePercent: quote.changepercentage,
                lastPriceUpdate: now,
              })
            );
          }
        }
        break;
      }

      case "crypto": {
        const prices = result.data as Record<string, CryptoPrice>;
        if (prices.bitcoin) {
          updateHoldingsAtIndexes(
            updated,
            getPriceIndexes(priceIndexes.crypto, "BTC"),
            (holding) => ({
              ...holding,
              currentPrice: holding.currency === "AED" ? prices.bitcoin.aed : prices.bitcoin.usd,
              previousClose: undefined,
              dayChangePercent: prices.bitcoin.usd_24h_change,
              lastPriceUpdate: now,
            })
          );
        }
        break;
      }
    }
  }

  return { holdings: updated, inrToAedRate, fxUpdatedAt };
}

export async function refreshDashboardPrices(holdings: Holding[]) {
  const { normalized: normalizedHoldings } = normalizeHoldings(holdings);
  const response = await fetch("/api/prices/refresh-all", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ holdings: normalizedHoldings }),
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
    ...applyRefreshResults(normalizedHoldings, results),
    failures,
  };
}
