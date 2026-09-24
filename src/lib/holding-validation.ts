import type { Holding, Purchase } from "@/lib/constants";

const ASSET_CLASSES = new Set([
  "Stocks",
  "ETFs",
  "Crypto",
  "Mutual Funds",
  "Cash",
  "Gold",
  "Bonds",
  "Others",
]);
const GEOGRAPHIES = new Set(["India", "US", "UAE", "Global", "Others"]);
const RISKS = new Set(["Low", "Medium", "High"]);
const CURRENCIES = new Set(["AED", "USD", "INR"]);
const PRICE_SOURCES = new Set([
  "mfapi",
  "twelvedata",
  "coingecko",
  "alphavantage",
  "frankfurter",
  "dfm",
  "manual",
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalFiniteNumber(value: unknown) {
  return value === undefined || isFiniteNumber(value);
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function isPurchase(value: unknown): value is Purchase {
  if (!value || typeof value !== "object") return false;
  const purchase = value as Partial<Purchase>;

  return (
    isFiniteNumber(purchase.quantity) &&
    isFiniteNumber(purchase.price) &&
    typeof purchase.date === "string" &&
    purchase.date.length <= 32 &&
    isOptionalFiniteNumber(purchase.fxRate)
  );
}

export function isHolding(value: unknown): value is Holding {
  if (!value || typeof value !== "object") return false;
  const holding = value as Partial<Holding>;

  return (
    typeof holding.id === "string" &&
    holding.id.length > 0 &&
    holding.id.length <= 128 &&
    typeof holding.platform === "string" &&
    holding.platform.length <= 100 &&
    typeof holding.assetName === "string" &&
    holding.assetName.length > 0 &&
    holding.assetName.length <= 200 &&
    typeof holding.ticker === "string" &&
    holding.ticker.length <= 64 &&
    typeof holding.assetClass === "string" &&
    ASSET_CLASSES.has(holding.assetClass) &&
    isOptionalString(holding.allocationClass) &&
    typeof holding.sector === "string" &&
    holding.sector.length <= 200 &&
    typeof holding.geography === "string" &&
    GEOGRAPHIES.has(holding.geography) &&
    typeof holding.risk === "string" &&
    RISKS.has(holding.risk) &&
    isFiniteNumber(holding.quantity) &&
    isFiniteNumber(holding.avgBuyPrice) &&
    isFiniteNumber(holding.currentPrice) &&
    typeof holding.currency === "string" &&
    CURRENCIES.has(holding.currency) &&
    typeof holding.notes === "string" &&
    holding.notes.length <= 5_000 &&
    typeof holding.priceSource === "string" &&
    PRICE_SOURCES.has(holding.priceSource) &&
    isOptionalString(holding.schemeCode) &&
    isOptionalString(holding.lastPriceUpdate) &&
    isOptionalString(holding.priceAsOf) &&
    (holding.priceSession === undefined || holding.priceSession === "pre-market") &&
    isOptionalFiniteNumber(holding.previousClose) &&
    isOptionalFiniteNumber(holding.dayChangePercent) &&
    (holding.purchases === undefined ||
      (Array.isArray(holding.purchases) &&
        holding.purchases.length <= 1_000 &&
        holding.purchases.every(isPurchase)))
  );
}
