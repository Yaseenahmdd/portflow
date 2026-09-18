import { fetchAlphaVantageMultiple } from "@/lib/api/alphavantage";
import { fetchCryptoPrices } from "@/lib/api/coingecko";
import { fetchDfmQuotes } from "@/lib/api/dfm";
import { fetchExchangeRates } from "@/lib/api/frankfurter";
import { fetchMutualFundNav } from "@/lib/api/mfapi";
import { CRYPTO_IDS, type Holding } from "@/lib/constants";

export type PriceRefreshScope = "all" | "live";

export interface PriceResult {
  source: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

function createPriceTask(
  source: string,
  loader: () => Promise<unknown>,
  hasUsableData: (data: unknown) => boolean = (data) => data !== null && data !== undefined
): Promise<PriceResult> {
  return loader()
    .then((data) => {
      if (!hasUsableData(data)) {
        throw new Error(`No usable data returned from ${source}`);
      }

      return {
        source,
        success: true,
        data,
      };
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[prices/${source}] ${message}`);
      return {
        source,
        success: false,
        error: `Failed to fetch ${source}`,
      };
    });
}

function isNonEmptyRecord(data: unknown) {
  return (
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data) &&
    Object.keys(data).length > 0
  );
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeIndianSymbol(holding: Holding) {
  if (!holding.ticker) return "";
  return holding.ticker.startsWith("NSE:") ? holding.ticker : `NSE:${holding.ticker}`;
}

export async function fetchAllPriceResults(
  holdings: Holding[],
  scope: PriceRefreshScope = "all"
): Promise<PriceResult[]> {
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
      .map((holding) => CRYPTO_IDS[holding.ticker.trim().toUpperCase()] || "")
  );

  const liveTasks = [
    createPriceTask(
      "indian-stocks",
      () => (indianSymbols.length ? fetchAlphaVantageMultiple(indianSymbols) : Promise.resolve({})),
      (data) => !indianSymbols.length || isNonEmptyRecord(data)
    ),
    createPriceTask(
      "us-etfs",
      () => (usEtfSymbols.length ? fetchAlphaVantageMultiple(usEtfSymbols) : Promise.resolve({})),
      (data) => !usEtfSymbols.length || isNonEmptyRecord(data)
    ),
    createPriceTask(
      "uae-stocks",
      () => (uaeStockSymbols.length ? fetchDfmQuotes(uaeStockSymbols) : Promise.resolve({})),
      (data) => !uaeStockSymbols.length || isNonEmptyRecord(data)
    ),
    createPriceTask(
      "crypto",
      () => (cryptoIds.length ? fetchCryptoPrices(cryptoIds) : Promise.resolve({})),
      (data) => !cryptoIds.length || isNonEmptyRecord(data)
    ),
  ];

  if (scope === "live") {
    return Promise.all(liveTasks);
  }

  return Promise.all([
    createPriceTask("currency", () => fetchExchangeRates()),
    createPriceTask(
      "indian-mf",
      () => (mfSchemeCodes.length ? fetchMutualFundNav(mfSchemeCodes) : Promise.resolve([])),
      (data) => !mfSchemeCodes.length || (Array.isArray(data) && data.length > 0)
    ),
    ...liveTasks,
  ]);
}
