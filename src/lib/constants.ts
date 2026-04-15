// Asset registry

export type AssetClass =
  | "Stocks"
  | "ETFs"
  | "Crypto"
  | "Mutual Funds"
  | "Cash"
  | "Gold"
  | "Bonds"
  | "Others";
export type AllocationClass = AssetClass;
export type Geography = "India" | "US" | "UAE" | "Global" | "Others";
export type Risk = "Low" | "Medium" | "High";
export type Currency = "AED" | "USD" | "INR";
export type Platform = "IG" | "iVestor" | "Binance" | "Groww" | "Custom";
export type PriceSource =
  | "mfapi"
  | "twelvedata"
  | "coingecko"
  | "alphavantage"
  | "frankfurter"
  | "dfm"
  | "manual";

export const PLATFORM_OPTIONS: string[] = ["IG", "iVestor", "Binance", "Groww", "Custom"];
export const ASSET_CLASS_OPTIONS: AssetClass[] = [
  "Stocks",
  "ETFs",
  "Crypto",
  "Mutual Funds",
  "Cash",
  "Gold",
  "Bonds",
  "Others",
];
export const ALLOCATION_CLASS_OPTIONS: AllocationClass[] = [...ASSET_CLASS_OPTIONS];
export const GEOGRAPHY_OPTIONS: Geography[] = ["India", "US", "UAE", "Global", "Others"];
export const RISK_OPTIONS: Risk[] = ["Low", "Medium", "High"];
export const CURRENCY_OPTIONS: Currency[] = ["AED", "USD", "INR"];

// Fixed USD to AED peg
export const USD_TO_AED = 3.6725;
export const CRYPTO_CACHE_TTL_MS = 60 * 1000;
export const STOCK_CACHE_TTL_MS = 105 * 1000;
export const FX_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
export const MUTUAL_FUND_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
export const CRYPTO_POLL_INTERVAL_MS = 60 * 1000;
export const STOCK_POLL_INTERVAL_MS = 120 * 1000;
export const REFERENCE_DATA_POLL_INTERVAL_MS = 12 * 60 * 60 * 1000;

// Mutual fund scheme codes
export const MF_SCHEMES: Record<string, { name: string; schemeCode: string }> = {
  "nippon-small-cap": {
    name: "Nippon India Small Cap Fund Direct Growth",
    schemeCode: "118778",
  },
  "bandhan-nifty-50": {
    name: "Bandhan Nifty 50 Index Fund Direct Plan Growth",
    schemeCode: "118482",
  },
};

// Indian stocks and ETFs
export const INDIAN_STOCK_TICKERS: Record<string, string> = {
  HDFCSML250: "NSE:HDFCSML250",
  GOLDBEES: "NSE:GOLDBEES",
  MID150BEES: "NSE:MID150BEES",
  HDFCAMC: "NSE:HDFCAMC",
};

// US ETFs
export const US_ETF_TICKERS = ["IBIT", "IAU", "BRRR", "ETHA", "GLD"];

// UAE stocks
export const UAE_STOCK_TICKERS = ["SALIK", "EMAAR"];

// Supported crypto tickers mapped to CoinGecko IDs
export const CRYPTO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
};

export const LIVE_CRYPTO_STREAMS: Record<string, string> = {
  BTC: "btcusdt@ticker",
};

export type RefreshScope = "crypto" | "stocks" | "fx" | "mutualFunds";

export interface NormalizedPrice {
  symbol: string;
  price: number;
  currency: Currency;
  source: string;
  timestamp: string;
}

export interface Purchase {
  quantity: number;
  price: number;
  date: string;
  fxRate?: number;
}

export interface Holding {
  id: string;
  platform: string;
  assetName: string;
  ticker: string;
  assetClass: AssetClass;
  allocationClass?: AllocationClass;
  sector: string;
  geography: Geography;
  risk: Risk;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currency: Currency;
  notes: string;
  priceSource: PriceSource;
  schemeCode?: string;
  lastPriceUpdate?: string;
  purchases?: Purchase[];
}

export interface ComputedHolding extends Holding {
  rateToAed: number;
  investedAmount: number;
  currentValue: number;
  gainLoss: number;
  localGainLossPct: number;
  gainLossPct: number;
  investedAmountAed: number;
  currentValueAed: number;
  gainLossAed: number;
}

export const DEFAULT_HOLDINGS: Holding[] = [];

export const PIE_COLORS = [
  "#0f172a",
  "#334155",
  "#64748b",
  "#94a3b8",
  "#cbd5e1",
  "#e2e8f0",
  "#1e293b",
  "#475569",
];

export const DARK_PIE_COLORS = ["#4A4DFF", "#F24B8A", "#6F2DBD", "#8896FF", "#C15CFF"];

export const LIGHT_PLATFORM_COLORS = {
  Groww: "#0E1A3B",
  iVestor: "#3C4A63",
  IG: "#6F7E99",
  Binance: "#A3B1C6",
};

export const LIGHT_ASSET_CLASS_COLORS = {
  ETFs: "#0E1A3B",
  Stocks: "#3C4A63",
  Crypto: "#6F7E99",
  Gold: "#94A3B8",
  "Mutual Funds": "#D6DEE9",
};

export const LIGHT_GEOGRAPHY_COLORS = {
  India: "#0E1A3B",
  UAE: "#3C4A63",
  US: "#6F7E99",
  Global: "#A3B1C6",
};
