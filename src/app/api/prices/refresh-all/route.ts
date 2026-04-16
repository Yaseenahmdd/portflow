import { fetchAlphaVantageMultiple } from "@/lib/api/alphavantage";
import { fetchCryptoPrices } from "@/lib/api/coingecko";
import { fetchDfmQuotes } from "@/lib/api/dfm";
import { fetchExchangeRates } from "@/lib/api/frankfurter";
import { fetchMutualFundNav } from "@/lib/api/mfapi";
import type { Holding } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PriceResult {
  source: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

function createPriceTask(source: string, loader: () => Promise<unknown>): Promise<PriceResult> {
  return loader()
    .then((data) => ({
      source,
      success: true,
      data,
    }))
    .catch((error: unknown) => {
      console.error(`[prices/${source}]`, error);
      return {
        source,
        success: false,
        error: `Failed to fetch ${source}`,
      };
    });
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeIndianSymbol(holding: Holding) {
  if (!holding.ticker) return "";
  return holding.ticker.startsWith("NSE:") ? holding.ticker : `NSE:${holding.ticker}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

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
      createPriceTask("currency", () => fetchExchangeRates()),
      createPriceTask("indian-mf", () => (mfSchemeCodes.length ? fetchMutualFundNav(mfSchemeCodes) : Promise.resolve([]))),
      createPriceTask("indian-stocks", () =>
        indianSymbols.length ? fetchAlphaVantageMultiple(indianSymbols) : Promise.resolve({})
      ),
      createPriceTask("us-etfs", () =>
        usEtfSymbols.length ? fetchAlphaVantageMultiple(usEtfSymbols) : Promise.resolve({})
      ),
      createPriceTask("uae-stocks", () =>
        uaeStockSymbols.length ? fetchDfmQuotes(uaeStockSymbols) : Promise.resolve({})
      ),
      createPriceTask("crypto", () => (cryptoIds.length ? fetchCryptoPrices(cryptoIds) : Promise.resolve({}))),
    ];

    const results = await Promise.all(tasks);

    return Response.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[prices/refresh-all]", error);
    return Response.json(
      { success: false, error: "Failed to refresh prices" },
      { status: 500 }
    );
  }
}
