import type { Holding } from "@/lib/constants";

export interface HoldingPriceIndexes {
  mutualFunds: Map<string, number[]>;
  indianStocks: Map<string, number[]>;
  usStocks: Map<string, number[]>;
  uaeStocks: Map<string, number[]>;
  crypto: Map<string, number[]>;
}

function addIndex(index: Map<string, number[]>, key: string | undefined, holdingIndex: number) {
  const normalizedKey = key?.trim().toUpperCase();
  if (!normalizedKey) return;

  const matchingIndexes = index.get(normalizedKey);
  if (matchingIndexes) {
    matchingIndexes.push(holdingIndex);
    return;
  }

  index.set(normalizedKey, [holdingIndex]);
}

function normalizeIndianTicker(ticker: string) {
  return ticker.trim().toUpperCase().replace(/^NSE:/, "");
}

export function buildHoldingPriceIndexes(holdings: Holding[]): HoldingPriceIndexes {
  const indexes: HoldingPriceIndexes = {
    mutualFunds: new Map(),
    indianStocks: new Map(),
    usStocks: new Map(),
    uaeStocks: new Map(),
    crypto: new Map(),
  };

  holdings.forEach((holding, holdingIndex) => {
    if (holding.priceSource === "mfapi") {
      addIndex(indexes.mutualFunds, holding.schemeCode, holdingIndex);
    }

    if (holding.priceSource === "alphavantage" && holding.geography === "India") {
      addIndex(indexes.indianStocks, normalizeIndianTicker(holding.ticker), holdingIndex);
    }

    if (holding.priceSource === "alphavantage" && holding.geography === "US") {
      addIndex(indexes.usStocks, holding.ticker, holdingIndex);
    }

    if (holding.priceSource === "dfm" && holding.geography === "UAE") {
      addIndex(indexes.uaeStocks, holding.ticker, holdingIndex);
    }

    if (holding.priceSource === "coingecko") {
      addIndex(indexes.crypto, holding.ticker, holdingIndex);
    }
  });

  return indexes;
}

export function getPriceIndexes(index: Map<string, number[]>, key: string) {
  return index.get(key.trim().toUpperCase()) || [];
}

export function updateHoldingsAtIndexes(
  holdings: Holding[],
  indexes: number[],
  update: (holding: Holding) => Holding
) {
  for (const index of indexes) {
    holdings[index] = update(holdings[index]);
  }
}
