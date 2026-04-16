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
      lastPriceUpdate: localHolding.lastPriceUpdate,
    };
  });
}
