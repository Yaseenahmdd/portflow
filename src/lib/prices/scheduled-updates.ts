import type { Holding } from "@/lib/constants";
import { getDubaiDateKey } from "@/lib/portfolio-analytics";
import { computeHolding } from "@/lib/utils";

// US markets close at 00:00 or 01:00 Dubai time depending on daylight saving,
// so a run in the small hours belongs to the Dubai day that just ended.
const SNAPSHOT_DAY_END_OFFSET_MS = 4 * 60 * 60 * 1000;

export interface ScheduledSnapshotRow {
  user_id: string;
  snapshot_date: string;
  total_value_aed: number;
  total_invested_aed: number;
  total_gain_loss_aed: number;
  holdings_count: number;
}

export function getScheduledSnapshotDate(now = new Date()) {
  return getDubaiDateKey(new Date(now.getTime() - SNAPSHOT_DAY_END_OFFSET_MS));
}

/**
 * Build one snapshot per user with the same totals the dashboard saves, so the
 * history has a row for every day even when nobody opens the app.
 */
export function buildScheduledSnapshots(
  holdings: Holding[],
  userIds: string[],
  inrToAedRate: number,
  snapshotDate: string
): ScheduledSnapshotRow[] {
  if (holdings.length !== userIds.length) {
    throw new Error("Scheduled snapshot inputs must have matching lengths.");
  }

  const byUser = new Map<string, ScheduledSnapshotRow>();

  holdings.forEach((holding, index) => {
    const userId = userIds[index];
    const computed = computeHolding(holding, inrToAedRate);
    const row = byUser.get(userId) ?? {
      user_id: userId,
      snapshot_date: snapshotDate,
      total_value_aed: 0,
      total_invested_aed: 0,
      total_gain_loss_aed: 0,
      holdings_count: 0,
    };

    row.total_value_aed += computed.currentValueAed;
    row.total_invested_aed += computed.investedAmountAed;
    row.total_gain_loss_aed += computed.gainLossAed;
    row.holdings_count += 1;
    byUser.set(userId, row);
  });

  return [...byUser.values()];
}

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
