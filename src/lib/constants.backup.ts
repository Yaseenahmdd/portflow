// ──────────────────────────────────────────────
// Asset registry — every holding you own
// ──────────────────────────────────────────────

export type AssetClass = 'Stocks' | 'ETFs' | 'Crypto' | 'Mutual Funds' | 'Cash' | 'Gold' | 'Bonds' | 'Others';
export type Geography = 'India' | 'US' | 'UAE' | 'Global' | 'Others';
export type Risk = 'Low' | 'Medium' | 'High';
export type Currency = 'AED' | 'USD' | 'INR';
export type Platform = 'IG' | 'iVestor' | 'Binance' | 'Groww' | 'Custom';
export type PriceSource = 'mfapi' | 'twelvedata' | 'coingecko' | 'alphavantage' | 'frankfurter' | 'dfm' | 'manual';

export const PLATFORM_OPTIONS: string[] = ['IG', 'iVestor', 'Binance', 'Groww', 'Custom'];
export const ASSET_CLASS_OPTIONS: AssetClass[] = ['Stocks', 'ETFs', 'Crypto', 'Mutual Funds', 'Cash', 'Gold', 'Bonds', 'Others'];
export const GEOGRAPHY_OPTIONS: Geography[] = ['India', 'US', 'UAE', 'Global', 'Others'];
export const RISK_OPTIONS: Risk[] = ['Low', 'Medium', 'High'];
export const CURRENCY_OPTIONS: Currency[] = ['AED', 'USD', 'INR'];

// Fixed USD → AED peg
export const USD_TO_AED = 3.6725;

// ──────────────────────────────────────────────
// Mutual Fund scheme codes (AMFI / MFAPI.in)
// ──────────────────────────────────────────────
export const MF_SCHEMES: Record<string, { name: string; schemeCode: string }> = {
  'nippon-small-cap': {
    name: 'Nippon India Small Cap Fund Direct Growth',
    schemeCode: '118778',
  },
  'bandhan-nifty-50': {
    name: 'Bandhan Nifty 50 Index Fund Direct Plan Growth',
    schemeCode: '118482',
  },
};

// ──────────────────────────────────────────────
// Indian stocks/ETFs — Alpha Vantage symbols
// ──────────────────────────────────────────────
export const INDIAN_STOCK_TICKERS: Record<string, string> = {
  HDFCSML250: 'NSE:HDFCSML250',
  GOLDBEES: 'NSE:GOLDBEES',
  MID150BEES: 'NSE:MID150BEES',
  HDFCAMC: 'NSE:HDFCAMC',
};

// ──────────────────────────────────────────────
// US ETFs — Twelve Data symbols
// ──────────────────────────────────────────────
export const US_ETF_TICKERS = ['IBIT', 'BRRR', 'ETHA', 'GLD'];

// ──────────────────────────────────────────────
// UAE Stocks — Twelve Data (DFM exchange)
// ──────────────────────────────────────────────
export const UAE_STOCK_TICKERS = ['SALIK', 'EMAAR'];

// ──────────────────────────────────────────────
// Crypto — CoinGecko IDs
// ──────────────────────────────────────────────
export const CRYPTO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
};

// ──────────────────────────────────────────────
// Holding type
// ──────────────────────────────────────────────
export interface Holding {
  id: string;
  platform: string;
  assetName: string;
  ticker: string;
  assetClass: AssetClass;
  sector: string;
  geography: Geography;
  risk: Risk;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currency: Currency;
  notes: string;
  priceSource: PriceSource;
  schemeCode?: string; // for MFs
  lastPriceUpdate?: string; // ISO timestamp
}

export interface ComputedHolding extends Holding {
  rateToAed: number;
  investedAmount: number;
  currentValue: number;
  gainLoss: number;
  gainLossPct: number;
  investedAmountAed: number;
  currentValueAed: number;
  gainLossAed: number;
}

// ──────────────────────────────────────────────
// Default/sample holdings
// ──────────────────────────────────────────────
export const DEFAULT_HOLDINGS: Holding[] = [];

// Chart colors
export const PIE_COLORS = [
  '#6BC2B8',
  '#D6A85F',
  '#6F93C8',
  '#56C288',
  '#D86B68',
  '#8DB6A4',
  '#C98C74',
  '#A1A7CF',
  '#7E9184',
  '#B9C1A1',
];
