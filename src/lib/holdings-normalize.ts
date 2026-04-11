import type { Holding } from "@/lib/constants";

const KNOWN_FUND_SCHEME_CODES: Array<{ pattern: RegExp; schemeCode: string }> = [
  { pattern: /bandhan\s+small\s+cap\s+fund/i, schemeCode: "147946" },
  { pattern: /bandhan\s+nifty\s+50\s+index\s+fund/i, schemeCode: "118482" },
  { pattern: /nippon.*small\s+cap\s+fund/i, schemeCode: "118778" },
  { pattern: /motilal\s+oswal\s+midcap\s+fund/i, schemeCode: "127042" },
];

function inferSchemeCode(assetName: string) {
  const match = KNOWN_FUND_SCHEME_CODES.find(({ pattern }) => pattern.test(assetName));
  return match?.schemeCode;
}

function looksLikeEtf(holding: Holding) {
  const assetName = holding.assetName.trim();
  const ticker = holding.ticker.trim().toUpperCase();

  return (
    /\betf\b/i.test(assetName) ||
    /\bbees\b/i.test(assetName) ||
    /\bETF\b/.test(ticker) ||
    /\bBEES\b/.test(ticker)
  );
}

export function normalizeHolding(holding: Holding): Holding {
  const normalized = { ...holding };

  if (normalized.assetClass === "Mutual Funds" && looksLikeEtf(normalized)) {
    normalized.assetClass = "ETFs";
    normalized.schemeCode = undefined;
  }

  if (normalized.assetClass === "Mutual Funds") {
    normalized.priceSource = "mfapi";
    const inferredSchemeCode = inferSchemeCode(normalized.assetName);
    if (inferredSchemeCode) {
      normalized.schemeCode = inferredSchemeCode;
    }
  }

  if (normalized.geography === "India" && normalized.ticker && ["Stocks", "ETFs", "Gold"].includes(normalized.assetClass)) {
    normalized.priceSource = "alphavantage";
  }

  if (normalized.geography === "US" && normalized.ticker && ["Stocks", "ETFs", "Gold"].includes(normalized.assetClass)) {
    normalized.priceSource = "alphavantage";
  }

  if (normalized.geography === "UAE" && normalized.ticker) {
    normalized.priceSource = "dfm";
    if (normalized.ticker === "EMAR") {
      normalized.ticker = "EMAAR";
    }
  }

  if (normalized.assetClass === "Crypto" && normalized.ticker === "BTC") {
    normalized.priceSource = "coingecko";
  }

  return normalized;
}

export function normalizeHoldings(holdings: Holding[]) {
  const normalized = holdings.map(normalizeHolding);
  const changed = JSON.stringify(normalized) !== JSON.stringify(holdings);
  return { normalized, changed };
}
