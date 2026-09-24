import type { Holding } from "@/lib/constants";

export interface ScheduledHoldingIdentity {
  userId: string;
  id: string;
}

export interface ScheduledPriceUpdate extends ScheduledHoldingIdentity {
  currentPrice: number;
  previousClose: number | null;
  dayChangePercent: number | null;
  lastPriceUpdate: string;
  priceAsOf: string | null;
  priceSession: "pre-market" | null;
}

export function buildScheduledPriceUpdates(
  originalHoldings: Holding[],
  refreshedHoldings: Holding[],
  identities: ScheduledHoldingIdentity[]
): ScheduledPriceUpdate[] {
  if (
    originalHoldings.length !== refreshedHoldings.length ||
    originalHoldings.length !== identities.length
  ) {
    throw new Error("Scheduled price update inputs must have matching lengths.");
  }

  const updates: ScheduledPriceUpdate[] = [];

  for (let index = 0; index < refreshedHoldings.length; index += 1) {
    const original = originalHoldings[index];
    const refreshed = refreshedHoldings[index];
    const identity = identities[index];

    if (
      !refreshed.lastPriceUpdate ||
      refreshed.lastPriceUpdate === original.lastPriceUpdate
    ) {
      continue;
    }

    updates.push({
      ...identity,
      currentPrice: refreshed.currentPrice,
      previousClose: refreshed.previousClose ?? null,
      dayChangePercent: refreshed.dayChangePercent ?? null,
      lastPriceUpdate: refreshed.lastPriceUpdate,
      priceAsOf: refreshed.priceAsOf ?? null,
      priceSession: refreshed.priceSession ?? null,
    });
  }

  return updates;
}
