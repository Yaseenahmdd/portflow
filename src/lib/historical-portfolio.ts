import type { Holding, Purchase } from "@/lib/constants";
import type { PortfolioSnapshot } from "@/lib/portfolio-snapshots";
import type { PortfolioTransaction } from "@/lib/transactions";

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

function getLinkedAssetTransactions(
  transactions: PortfolioTransaction[],
  holdingId: string,
  endDate: string
) {
  const typeOrder: Record<string, number> = { buy: 0, split: 1, sell: 2 };
  return transactions
    .filter(
      (transaction) =>
        transaction.holdingId === holdingId &&
        ["buy", "sell", "split"].includes(transaction.type) &&
        isValidDateKey(transaction.date) &&
        transaction.date <= endDate
    )
    .sort(
      (first, second) =>
        first.date.localeCompare(second.date) ||
        (first.createdAt || "").localeCompare(second.createdAt || "") ||
        (typeOrder[first.type] ?? 3) - (typeOrder[second.type] ?? 3) ||
        first.id.localeCompare(second.id)
    );
}

function purchaseFromTransaction(transaction: PortfolioTransaction): Purchase {
  return {
    quantity: transaction.quantity || 0,
    price: transaction.price || 0,
    date: transaction.date,
    ...(transaction.fxRateToAed ? { fxRate: transaction.fxRateToAed } : {}),
  };
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
  endDate: string,
  ledgerTransactions: PortfolioTransaction[] = []
) {
  const pointsByDate = new Map<string, number>();
  const purchaseDates = new Set<string>();
  const purchases = ledgerTransactions.length
    ? ledgerTransactions
        .filter((transaction) => transaction.type === "buy")
        .map(purchaseFromTransaction)
    : getValidPurchases(holding, endDate);

  for (const purchase of purchases) {
    const price = toFinitePositiveNumber(purchase.price);
    if (price) {
      purchaseDates.add(purchase.date);
      if (!pointsByDate.has(purchase.date)) {
        pointsByDate.set(purchase.date, price);
      }
    }
  }

  for (const point of history) {
    const price = toFinitePositiveNumber(point.price);
    const effectiveDate = purchaseDates.has(point.date) ? addDays(point.date, 1) : point.date;
    if (
      price &&
      isValidDateKey(point.date) &&
      effectiveDate <= endDate &&
      !purchaseDates.has(effectiveDate)
    ) {
      // Keep the actual execution price on purchase dates so adding capital does
      // not appear as an immediate market gain. That day's close becomes the
      // carried market value on the following day unless a newer close replaces it.
      pointsByDate.set(effectiveDate, price);
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

export function getHistoricalPortfolioStartDate(
  holdings: Holding[],
  endDate: string,
  transactions: PortfolioTransaction[] = []
) {
  const ledgerHoldingIds = new Set(
    transactions.flatMap((transaction) =>
      transaction.holdingId && ["buy", "sell", "split"].includes(transaction.type)
        ? [transaction.holdingId]
        : []
    )
  );
  const purchaseDates = [
    ...holdings.flatMap((holding) =>
      ledgerHoldingIds.has(holding.id)
        ? []
        : getValidPurchases(holding, endDate).map((purchase) => purchase.date)
    ),
    ...transactions.flatMap((transaction) =>
      transaction.type === "buy" &&
      transaction.holdingId &&
      isValidDateKey(transaction.date) &&
      transaction.date <= endDate
        ? [transaction.date]
        : []
    ),
  ];

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
  }: BuildHistoricalSnapshotsOptions,
  transactions: PortfolioTransaction[] = []
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
    const ledgerTransactions = getLinkedAssetTransactions(transactions, holding.id, endDate);
    const fallbackPrice = toFinitePositiveNumber(holding.avgBuyPrice);
    const history = preparePriceHistory(
      holding,
      priceHistories[holding.id] || [],
      endDate,
      ledgerTransactions
    );
    let transactionIndex = 0;
    let ledgerQuantity = 0;
    let ledgerCostBasisAed = 0;

    const readLedgerState = (date: string) => {
      while (
        transactionIndex < ledgerTransactions.length &&
        ledgerTransactions[transactionIndex].date <= date
      ) {
        const transaction = ledgerTransactions[transactionIndex];
        const rateToAed =
          holding.currency === "AED"
            ? 1
            : holding.currency === "USD"
              ? USD_TO_AED_RATE
              : toFinitePositiveNumber(transaction.fxRateToAed) ||
                inrRateByDate.get(transaction.date) ||
                safeFallbackInrRate;

        if (transaction.type === "buy") {
          const quantity = toFinitePositiveNumber(transaction.quantity);
          ledgerQuantity += quantity;
          ledgerCostBasisAed +=
            (quantity * toFinitePositiveNumber(transaction.price) +
              Math.max(0, Number(transaction.fees) || 0)) *
            rateToAed;
        } else if (transaction.type === "sell") {
          const soldQuantity = Math.min(
            ledgerQuantity,
            toFinitePositiveNumber(transaction.quantity)
          );
          const averageCostAed = ledgerQuantity > 0 ? ledgerCostBasisAed / ledgerQuantity : 0;
          ledgerQuantity -= soldQuantity;
          ledgerCostBasisAed -= averageCostAed * soldQuantity;

          if (ledgerQuantity <= 1e-9) {
            ledgerQuantity = 0;
            ledgerCostBasisAed = 0;
          }
        } else if (transaction.type === "split") {
          ledgerQuantity *= toFinitePositiveNumber(transaction.splitRatio) || 1;
        }

        transactionIndex += 1;
      }

      return { quantity: ledgerQuantity, costBasisAed: ledgerCostBasisAed };
    };

    return {
      holding,
      purchases,
      ledgerTransactions,
      readLedgerState,
      readPrice: createCarriedValueReader(history, fallbackPrice),
    };
  });

  return getDateKeys(startDate, endDate).map((snapshotDate) => {
    const inrRateOnDate = inrRateByDate.get(snapshotDate) || safeFallbackInrRate;
    let totalInvestedAed = 0;
    let totalValueAed = 0;
    let holdingsCount = 0;

    for (const { holding, purchases, ledgerTransactions, readLedgerState, readPrice } of holdingStates) {
      if (ledgerTransactions.length) {
        const ledgerState = readLedgerState(snapshotDate);
        if (!ledgerState.quantity) continue;

        holdingsCount += 1;
        totalInvestedAed += ledgerState.costBasisAed;
        totalValueAed +=
          ledgerState.quantity *
          readPrice(snapshotDate) *
          getValuationRateToAed(holding, inrRateOnDate, safeFallbackInrRate);
        continue;
      }

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
