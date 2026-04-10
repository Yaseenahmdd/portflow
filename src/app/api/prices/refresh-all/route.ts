import { fetchAlphaVantageMultiple } from "@/lib/api/alphavantage";
import { fetchCryptoPrices } from "@/lib/api/coingecko";
import { fetchDfmQuotes } from "@/lib/api/dfm";
import { fetchExchangeRates } from "@/lib/api/frankfurter";
import { fetchMutualFundNav } from "@/lib/api/mfapi";
import type { Holding } from "@/lib/constants";

export const dynamic = "force-dynamic";

interface PriceResult {
  source: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeIndianSymbol(holding: Holding) {
  if (!holding.ticker) return "";
  return holding.ticker.startsWith("NSE:") ? holding.ticker : `NSE:${holding.ticker}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const holdings = (body?.holdings || []) as Holding[];

    const mfSchemeCodes = unique(
      holdings
        .filter((holding) => holding.priceSource === "mfapi" && holding.schemeCode)
        .map((holding) => holding.schemeCode || "")
    );

    const indianSymbols = unique(
      holdings
        .filter(
          (holding) =>
            holding.priceSource === "alphavantage" &&
            holding.geography === "India" &&
            Boolean(holding.ticker)
        )
        .map(normalizeIndianSymbol)
    );

    const usEtfSymbols = unique(
      holdings
        .filter(
          (holding) =>
            holding.priceSource === "alphavantage" &&
            holding.geography === "US" &&
            Boolean(holding.ticker)
        )
        .map((holding) => holding.ticker)
    );

    const uaeStockSymbols = unique(
      holdings
        .filter(
          (holding) =>
            holding.priceSource === "dfm" &&
            holding.geography === "UAE" &&
            Boolean(holding.ticker)
        )
        .map((holding) => holding.ticker)
    );

    const cryptoIds = unique(
      holdings
        .filter((holding) => holding.priceSource === "coingecko" && Boolean(holding.ticker))
        .map((holding) => {
          if (holding.ticker === "BTC") return "bitcoin";
          return "";
        })
    );

    const tasks: Promise<PriceResult>[] = [
      Promise.resolve({ source: "currency", success: true, data: await fetchExchangeRates() }),
      Promise.resolve({
        source: "indian-mf",
        success: true,
        data: mfSchemeCodes.length ? await fetchMutualFundNav(mfSchemeCodes) : [],
      }),
      Promise.resolve({
        source: "indian-stocks",
        success: true,
        data: indianSymbols.length ? await fetchAlphaVantageMultiple(indianSymbols) : {},
      }),
      Promise.resolve({
        source: "us-etfs",
        success: true,
        data: usEtfSymbols.length ? await fetchAlphaVantageMultiple(usEtfSymbols) : {},
      }),
      Promise.resolve({
        source: "uae-stocks",
        success: true,
        data: uaeStockSymbols.length ? await fetchDfmQuotes(uaeStockSymbols) : {},
      }),
      Promise.resolve({
        source: "crypto",
        success: true,
        data: cryptoIds.length ? await fetchCryptoPrices(cryptoIds) : {},
      }),
    ];

    const results = await Promise.all(tasks);

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
      { status: 500 }
    );
  }
}
