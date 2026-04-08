import type { Holding } from "@/lib/constants";

const KNOWN_FUND_SCHEME_CODES: Array<{ pattern: RegExp; schemeCode: string }> = [
  { pattern: /bandhan\s+small\s+cap\s+fund/i, schemeCode: "147946" },
  { pattern: /bandhan\s+nifty\s+50\s+index\s+fund/i, schemeCode: "118482" },
  { pattern: /nippon.*small\s+cap\s+fund/i, schemeCode: "118778" },
  { pattern: /motilal\s+oswal\s+midcap\s+fund/i, schemeCode: "127042" },
];

const ASSET_CLASS_ALIASES: Record<string, Holding["assetClass"]> = {
  stock: "Stocks",
  stocks: "Stocks",
  etf: "ETFs",
  etfs: "ETFs",
  crypto: "Crypto",
  cryptocurrency: "Crypto",
  cryptocurrencies: "Crypto",
  mutualfund: "Mutual Funds",
  mutualfunds: "Mutual Funds",
  "mutual fund": "Mutual Funds",
  "mutual funds": "Mutual Funds",
  cash: "Cash",
  gold: "Gold",
  bond: "Bonds",
  bonds: "Bonds",
  other: "Others",
  others: "Others",
};

const GEOGRAPHY_ALIASES: Record<string, Holding["geography"]> = {
  india: "India",
  ind: "India",
  us: "US",
  usa: "US",
  unitedstates: "US",
  "united states": "US",
  uae: "UAE",
  unitedarabemirates: "UAE",
  "united arab emirates": "UAE",
  global: "Global",
  other: "Others",
  others: "Others",
};

const RISK_ALIASES: Record<string, Holding["risk"]> = {
  low: "Low",
  medium: "Medium",
  med: "Medium",
  high: "High",
  veryhigh: "High",
  "very high": "High",
};

const CURRENCY_ALIASES: Record<string, Holding["currency"]> = {
  aed: "AED",
  usd: "USD",
  inr: "INR",
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLookupKey(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "");
}

function inferSchemeCode(assetName: string) {
  const normalizedName = normalizeWhitespace(assetName);
  const match = KNOWN_FUND_SCHEME_CODES.find(({ pattern }) => pattern.test(normalizedName));
  return match?.schemeCode;
}

function normalizeAssetClass(value: string): Holding["assetClass"] | null {
  return ASSET_CLASS_ALIASES[normalizeLookupKey(value)] || null;
}

function normalizeGeography(value: string): Holding["geography"] | null {
  return GEOGRAPHY_ALIASES[normalizeLookupKey(value)] || null;
}

function normalizeRisk(value: string): Holding["risk"] | null {
  return RISK_ALIASES[normalizeLookupKey(value)] || null;
}

function normalizeCurrency(value: string): Holding["currency"] | null {
  return CURRENCY_ALIASES[normalizeLookupKey(value)] || null;
}

function normalizeTicker(holding: Holding) {
  const ticker = normalizeWhitespace(holding.ticker || "");
  if (!ticker) return "";

  if (holding.geography === "India" && ticker.toUpperCase().startsWith("NSE:")) {
    const [, symbol] = ticker.split(":");
    return `NSE:${symbol.trim().toUpperCase()}`;
  }

  return ticker.toUpperCase();
}

export function normalizeHolding(holding: Holding): Holding {
  const normalized: Holding = {
    ...holding,
    assetName: normalizeWhitespace(holding.assetName || ""),
    platform: normalizeWhitespace(holding.platform || ""),
    sector: normalizeWhitespace(holding.sector || ""),
    notes: normalizeWhitespace(holding.notes || ""),
    ticker: normalizeWhitespace(holding.ticker || ""),
    priceSource: holding.priceSource || "manual",
  };

  const normalizedAssetClass = normalizeAssetClass(String(holding.assetClass || ""));
  if (normalizedAssetClass) {
    normalized.assetClass = normalizedAssetClass;
  }

  const normalizedGeography = normalizeGeography(String(holding.geography || ""));
  if (normalizedGeography) {
    normalized.geography = normalizedGeography;
  }

  const normalizedRisk = normalizeRisk(String(holding.risk || ""));
  if (normalizedRisk) {
    normalized.risk = normalizedRisk;
  }

  const normalizedCurrency = normalizeCurrency(String(holding.currency || ""));
  if (normalizedCurrency) {
    normalized.currency = normalizedCurrency;
  }

  normalized.ticker = normalizeTicker(normalized);

  if (normalized.assetClass === "Mutual Funds" || normalized.schemeCode) {
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
    normalized.priceSource = "twelvedata";
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
