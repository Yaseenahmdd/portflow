import type { Holding, Purchase } from "@/lib/constants";
import type { PortfolioSnapshot } from "@/lib/portfolio-snapshots";

const USD_TO_AED_RATE = 3.6725;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface HistoricalPricePoint {
  date: string;
  price: number;
}

export type HistoricalPriceHistories = Record<string, HistoricalPricePoint[]>;

interface BuildHistoricalSnapshotsOptions {
  startDate: string;
  endDate: string;
  fallbackInrToAedRate: number;
}

function isValidDateKey(value: string) {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function toFinitePositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getDateKeys(startDate: string, endDate: string) {
  const dates: string[] = [];

  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    dates.push(date);
  }

  return dates;
}

function getValidPurchases(holding: Holding, endDate: string) {
  return (holding.purchases || [])
    .filter((purchase) => isValidDateKey(purchase.date) && purchase.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getPurchaseRateToAed(
  holding: Holding,
  purchase: Purchase,
  inrRateOnPurchaseDate: number,
  fallbackInrToAedRate: number
) {
  if (holding.currency === "AED") return 1;
  if (holding.currency === "USD") return USD_TO_AED_RATE;

  return (
    toFinitePositiveNumber(purchase.fxRate) ||
    inrRateOnPurchaseDate ||
    fallbackInrToAedRate
  );
}

function getValuationRateToAed(
  holding: Holding,
  inrRateOnDate: number,
  fallbackInrToAedRate: number
) {
  if (holding.currency === "AED") return 1;
  if (holding.currency === "USD") return USD_TO_AED_RATE;
  return inrRateOnDate || fallbackInrToAedRate;
}

function preparePriceHistory(
  holding: Holding,
  history: HistoricalPricePoint[],
  endDate: string
) {
  const pointsByDate = new Map<string, number>();

  for (const purchase of getValidPurchases(holding, endDate)) {
    const price = toFinitePositiveNumber(purchase.price);
    if (price && !pointsByDate.has(purchase.date)) {
      pointsByDate.set(purchase.date, price);
    }
  }

  for (const point of history) {
    const price = toFinitePositiveNumber(point.price);
    if (price && isValidDateKey(point.date) && point.date <= endDate) {
      // A market close or published NAV is preferred to an execution-price fallback.
      pointsByDate.set(point.date, price);
    }
  }

  const currentPrice = toFinitePositiveNumber(holding.currentPrice);
  if (currentPrice) {
    pointsByDate.set(endDate, currentPrice);
  }

  return [...pointsByDate.entries()]
    .map(([date, price]) => ({ date, price }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function createCarriedValueReader(points: HistoricalPricePoint[], fallbackValue: number) {
  let pointIndex = 0;
  let carriedValue = fallbackValue;

  return (date: string) => {
    while (pointIndex < points.length && points[pointIndex].date <= date) {
      carriedValue = points[pointIndex].price;
      pointIndex += 1;
    }

    return carriedValue;
  };
}

export function getHistoricalPortfolioStartDate(holdings: Holding[], endDate: string) {
  const purchaseDates = holdings.flatMap((holding) =>
    getValidPurchases(holding, endDate).map((purchase) => purchase.date)
  );

  if (!purchaseDates.length) return null;
  return purchaseDates.sort((a, b) => a.localeCompare(b))[0];
}

export function buildHistoricalPortfolioSnapshots(
  holdings: Holding[],
  priceHistories: HistoricalPriceHistories,
  inrToAedHistory: HistoricalPricePoint[],
  {
    startDate,
    endDate,
    fallbackInrToAedRate,
  }: BuildHistoricalSnapshotsOptions
): PortfolioSnapshot[] {
  if (!isValidDateKey(startDate) || !isValidDateKey(endDate) || startDate > endDate) {
    return [];
  }

  const safeFallbackInrRate = toFinitePositiveNumber(fallbackInrToAedRate) || 0.044;
  const sortedFxHistory = inrToAedHistory
    .filter((point) => isValidDateKey(point.date) && toFinitePositiveNumber(point.price))
    .sort((a, b) => a.date.localeCompare(b.date));
  const readInrRate = createCarriedValueReader(sortedFxHistory, safeFallbackInrRate);
  const inrRateByDate = new Map<string, number>();

  for (const date of getDateKeys(startDate, endDate)) {
    inrRateByDate.set(date, readInrRate(date));
  }

  const holdingStates = holdings.map((holding) => {
    const purchases = getValidPurchases(holding, endDate);
    const fallbackPrice = toFinitePositiveNumber(holding.avgBuyPrice);
    const history = preparePriceHistory(holding, priceHistories[holding.id] || [], endDate);

    return {
      holding,
      purchases,
      readPrice: createCarriedValueReader(history, fallbackPrice),
    };
  });

  return getDateKeys(startDate, endDate).map((snapshotDate) => {
    const inrRateOnDate = inrRateByDate.get(snapshotDate) || safeFallbackInrRate;
    let totalInvestedAed = 0;
    let totalValueAed = 0;
    let holdingsCount = 0;

    for (const { holding, purchases, readPrice } of holdingStates) {
      const activePurchases = purchases.filter((purchase) => purchase.date <= snapshotDate);
      const hasPurchaseHistory = purchases.length > 0;
      const quantity = hasPurchaseHistory
        ? activePurchases.reduce((sum, purchase) => sum + toFinitePositiveNumber(purchase.quantity), 0)
        : toFinitePositiveNumber(holding.quantity);

      if (!quantity) continue;

      holdingsCount += 1;

      if (hasPurchaseHistory) {
        totalInvestedAed += activePurchases.reduce((sum, purchase) => {
          const purchaseRate = getPurchaseRateToAed(
            holding,
            purchase,
            inrRateByDate.get(purchase.date) || safeFallbackInrRate,
            safeFallbackInrRate
          );

          return (
            sum +
            toFinitePositiveNumber(purchase.quantity) *
              toFinitePositiveNumber(purchase.price) *
              purchaseRate
          );
        }, 0);
      } else {
        totalInvestedAed +=
          quantity *
          toFinitePositiveNumber(holding.avgBuyPrice) *
          getValuationRateToAed(holding, inrRateOnDate, safeFallbackInrRate);
      }

      totalValueAed +=
        quantity *
        readPrice(snapshotDate) *
        getValuationRateToAed(holding, inrRateOnDate, safeFallbackInrRate);
    }

    return {
      snapshotDate,
      totalValueAed,
      totalInvestedAed,
      totalGainLossAed: totalValueAed - totalInvestedAed,
      holdingsCount,
    };
  });
}
