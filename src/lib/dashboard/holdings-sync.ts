import type { Holding } from "@/lib/constants";

export function getHoldingsSignature(holdings: Holding[]) {
  return JSON.stringify(holdings);
}

function getTimestampMs(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function mergeRemoteHoldingsWithLocalPrices(remoteHoldings: Holding[], localHoldings: Holding[]) {
  const localById = new Map(localHoldings.map((holding) => [holding.id, holding]));

  return remoteHoldings.map((remoteHolding) => {
    const localHolding = localById.get(remoteHolding.id);
    if (!localHolding) {
      return remoteHolding;
    }

    const localPriceUpdatedAt = getTimestampMs(localHolding.lastPriceUpdate);
    const remotePriceUpdatedAt = getTimestampMs(remoteHolding.lastPriceUpdate);

    if (localPriceUpdatedAt <= remotePriceUpdatedAt) {
      return remoteHolding;
    }

    return {
      ...remoteHolding,
      currentPrice: localHolding.currentPrice,
      previousClose: localHolding.previousClose,
      dayChangePercent: localHolding.dayChangePercent,
      lastPriceUpdate: localHolding.lastPriceUpdate,
      priceAsOf: localHolding.priceAsOf,
      priceSession: localHolding.priceSession,
    };
  });
}

/**
 * Apply a finished price refresh to the latest holdings. The refresh started
 * from an earlier snapshot, so only its newer quotes are taken; renames, edits
 * and remote syncs made while prices loaded are kept.
 */
export function applyRefreshedPrices(currentHoldings: Holding[], refreshedHoldings: Holding[]) {
  return mergeRemoteHoldingsWithLocalPrices(currentHoldings, refreshedHoldings);
}
