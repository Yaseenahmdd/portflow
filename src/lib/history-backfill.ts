import type { Holding } from "@/lib/constants";
import type { PortfolioSnapshot } from "@/lib/portfolio-snapshots";
import { getAedRate, toNumber } from "@/lib/utils";

function sortDateKeys(dateKeys: Iterable<string>) {
  return [...dateKeys].sort((a, b) => a.localeCompare(b));
}

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function getInvestedAmountOnDate(holding: Holding, snapshotDate: string, inrToAedRate: number) {
  const snapshotTime = new Date(`${snapshotDate}T23:59:59`).getTime();

  if (holding.purchases?.length) {
    return holding.purchases.reduce((sum, purchase) => {
      const purchaseTime = new Date(`${purchase.date}T23:59:59`).getTime();

      if (Number.isNaN(purchaseTime) || purchaseTime > snapshotTime) {
        return sum;
      }

      const quantity = toNumber(purchase.quantity);
      const price = toNumber(purchase.price);
      const rateToAed =
        holding.currency === "INR"
          ? toNumber(purchase.fxRate) || inrToAedRate
          : getAedRate(holding.currency, inrToAedRate);

      return sum + quantity * price * rateToAed;
    }, 0);
  }

  const quantity = toNumber(holding.quantity);
  const avgBuyPrice = toNumber(holding.avgBuyPrice);
  const rateToAed = getAedRate(holding.currency, inrToAedRate);
  return quantity * avgBuyPrice * rateToAed;
}

function wasHoldingActiveOnDate(holding: Holding, snapshotDate: string) {
  if (!holding.purchases?.length) {
    return true;
  }

  const snapshotTime = new Date(`${snapshotDate}T23:59:59`).getTime();

  return holding.purchases.some((purchase) => {
    const purchaseTime = new Date(`${purchase.date}T23:59:59`).getTime();
    return !Number.isNaN(purchaseTime) && purchaseTime <= snapshotTime;
  });
}

export function buildBackfilledSnapshots(
  holdings: Holding[],
  existingSnapshots: PortfolioSnapshot[],
  inrToAedRate: number
) {
  const existingByDate = new Map(existingSnapshots.map((snapshot) => [snapshot.snapshotDate, snapshot]));
  const backfillDates = new Set<string>();
  const todayDate = getTodayDateKey();

  for (const holding of holdings) {
    for (const purchase of holding.purchases || []) {
      const dateKey = purchase.date?.trim();
      if (dateKey && dateKey <= todayDate) {
        backfillDates.add(dateKey);
      }
    }
  }

  const generatedSnapshots = sortDateKeys(backfillDates)
    .filter((dateKey) => !existingByDate.has(dateKey))
    .map<PortfolioSnapshot>((dateKey) => {
      const totalInvestedAed = holdings.reduce(
        (sum, holding) => sum + getInvestedAmountOnDate(holding, dateKey, inrToAedRate),
        0
      );
      const holdingsCount = holdings.filter((holding) => wasHoldingActiveOnDate(holding, dateKey)).length;

      return {
        snapshotDate: dateKey,
        totalInvestedAed,
        totalValueAed: totalInvestedAed,
        totalGainLossAed: 0,
        holdingsCount,
      };
    });

  return [...existingSnapshots, ...generatedSnapshots].sort((a, b) =>
    a.snapshotDate.localeCompare(b.snapshotDate)
  );
}
