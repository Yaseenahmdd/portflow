import { computeInrToAed, type ExchangeRates } from "@/lib/api/frankfurter";
import type { Holding } from "@/lib/constants";
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

function applyRefreshResults(holdings: Holding[], results: PriceResult[]) {
  const now = new Date().toISOString();
  const updated = [...holdings];
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
          const index = updated.findIndex((holding) => holding.schemeCode === nav.schemeCode);
          if (index !== -1) {
            updated[index] = { ...updated[index], currentPrice: nav.nav, lastPriceUpdate: now };
          }
        }
        break;
      }

      case "indian-stocks": {
        const quotes = result.data as Record<string, { price: number }>;
        for (const [ticker, quote] of Object.entries(quotes)) {
          const index = updated.findIndex(
            (holding) => holding.ticker === ticker || holding.ticker === `NSE:${ticker}`
          );
          if (index !== -1) {
            updated[index] = { ...updated[index], currentPrice: quote.price, lastPriceUpdate: now };
          }
        }
        break;
      }

      case "us-etfs": {
        const quotes = result.data as Record<string, { price: number }>;
        for (const [symbol, quote] of Object.entries(quotes)) {
          const index = updated.findIndex((holding) => holding.ticker === symbol);
          if (index !== -1 && quote.price !== undefined) {
            updated[index] = { ...updated[index], currentPrice: quote.price, lastPriceUpdate: now };
          }
        }
        break;
      }

      case "uae-stocks": {
        const quotes = result.data as Record<string, { lastradeprice: number }>;
        for (const [symbol, quote] of Object.entries(quotes)) {
          const index = updated.findIndex((holding) => holding.ticker === symbol);
          if (index !== -1 && quote.lastradeprice > 0) {
            updated[index] = {
              ...updated[index],
              currentPrice: quote.lastradeprice,
              lastPriceUpdate: now,
            };
          }
        }
        break;
      }

      case "crypto": {
        const prices = result.data as Record<string, { usd: number; aed: number }>;
        if (prices.bitcoin) {
          const index = updated.findIndex((holding) => holding.ticker === "BTC");
          if (index !== -1) {
            const btcPrice = updated[index].currency === "AED" ? prices.bitcoin.aed : prices.bitcoin.usd;
            updated[index] = { ...updated[index], currentPrice: btcPrice, lastPriceUpdate: now };
          }
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
