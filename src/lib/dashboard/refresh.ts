import { computeInrToAed, type ExchangeRates } from "@/lib/api/frankfurter";
import type { CryptoPrice } from "@/lib/api/coingecko";
import { CRYPTO_IDS, type Holding } from "@/lib/constants";
import type { PriceRefreshScope } from "@/lib/prices/refresh-all";
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
        const navData = result.data as { schemeCode: string; nav: number; previousNav?: number }[];
        for (const nav of navData) {
          updateHoldingsAtIndexes(
            updated,
            getPriceIndexes(priceIndexes.mutualFunds, nav.schemeCode),
            (holding) => {
              const existingPrice = Number(holding.currentPrice);
              const priceChanged =
                Number.isFinite(existingPrice) && existingPrice > 0 && existingPrice !== nav.nav;
              const previousClose =
                nav.previousNav && nav.previousNav > 0
                  ? nav.previousNav
                  : priceChanged
                    ? existingPrice
                    : holding.previousClose;

              return {
                ...holding,
                currentPrice: nav.nav,
                previousClose,
                dayChangePercent:
                  previousClose && previousClose > 0
                    ? ((nav.nav - previousClose) / previousClose) * 100
                    : undefined,
                lastPriceUpdate: now,
              };
            }
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
        for (const [ticker, coinGeckoId] of Object.entries(CRYPTO_IDS)) {
          const price = prices[coinGeckoId];
          if (!price) continue;

          updateHoldingsAtIndexes(
            updated,
            getPriceIndexes(priceIndexes.crypto, ticker),
            (holding) => {
              const currentPrice = holding.currency === "AED" ? price.aed : price.usd;
              const previousClose =
                holding.currency === "AED"
                  ? price.previousCloseAed
                  : price.previousCloseUsd;

              return {
                ...holding,
                currentPrice,
                previousClose,
                dayChangePercent:
                  previousClose && previousClose > 0
                    ? ((currentPrice - previousClose) / previousClose) * 100
                    : undefined,
                lastPriceUpdate: now,
              };
            }
          );
        }
        break;
      }
    }
  }

  return { holdings: updated, inrToAedRate, fxUpdatedAt };
}

export async function refreshDashboardPrices(
  holdings: Holding[],
  scope: PriceRefreshScope = "all"
) {
  const { normalized: normalizedHoldings } = normalizeHoldings(holdings);
  const response = await fetch("/api/prices/refresh-all", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ holdings: normalizedHoldings, scope }),
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
