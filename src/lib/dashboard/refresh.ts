import { computeInrToAed, type ExchangeRates } from "@/lib/api/frankfurter";
import type { CryptoPrice } from "@/lib/api/coingecko";
import type { StockQuote } from "@/lib/api/alphavantage";
import type { DfmQuote } from "@/lib/api/dfm";
import { parseNavDate } from "@/lib/api/mfapi";
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
        const navData = result.data as { schemeCode: string; nav: number; date?: string; previousNav?: number }[];
        for (const nav of navData) {
          const navTimestamp = nav.date ? parseNavDate(nav.date) : null;
          const navAsOf = navTimestamp !== null ? new Date(navTimestamp).toISOString() : undefined;
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
                priceAsOf: navAsOf,
                lastPriceUpdate: now,
              };
            }
          );
        }
        break;
      }

      case "indian-stocks": {
        const quotes = result.data as Record<string, StockQuote>;
        for (const [ticker, quote] of Object.entries(quotes)) {
          if (!Number.isFinite(quote.price) || quote.price <= 0) continue;
          updateHoldingsAtIndexes(
            updated,
            getPriceIndexes(priceIndexes.indianStocks, ticker),
            (holding) => ({
              ...holding,
              currentPrice: quote.price,
              previousClose: quote.previousClose,
              dayChangePercent: Number.parseFloat(quote.changePercent || "0"),
              priceAsOf: quote.priceAsOf,
              priceSession: undefined,
              lastPriceUpdate: now,
            })
          );
        }
        break;
      }

      case "us-etfs": {
        const quotes = result.data as Record<string, StockQuote>;
        for (const [symbol, quote] of Object.entries(quotes)) {
          if (Number.isFinite(quote.price) && quote.price > 0) {
            updateHoldingsAtIndexes(
              updated,
              getPriceIndexes(priceIndexes.usStocks, symbol),
              (holding) => ({
                ...holding,
                currentPrice: quote.price,
                previousClose: quote.previousClose,
                dayChangePercent: Number.parseFloat(quote.changePercent || "0"),
                priceAsOf: quote.priceAsOf,
                priceSession: quote.priceSession,
                lastPriceUpdate: now,
              })
            );
          }
        }
        break;
      }

      case "uae-stocks": {
        const quotes = result.data as Record<string, DfmQuote>;
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
                // DFM reports trade times in Dubai local time without an offset.
                priceAsOf: quote.lastradetime ? new Date(`${quote.lastradetime}+04:00`).toISOString() : undefined,
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
