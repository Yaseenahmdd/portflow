import type { Currency, Holding, Purchase } from "@/lib/constants";
import type { PortfolioTransaction } from "@/lib/transactions";

const QUANTITY_EPSILON = 1e-9;
const CONNECTION_STORAGE_PREFIX = "portflow-ledger-connection-";
const USD_TO_AED_RATE = 3.6725;

export interface LedgerHoldingChange {
  holdingId: string;
  assetName: string;
  currency: Currency;
  currentQuantity: number;
  nextQuantity: number;
  currentAveragePrice: number;
  nextAveragePrice: number;
  realizedGain: number;
}

export interface LedgerHoldingIssue {
  transactionId: string;
  message: string;
}

export interface LedgerHoldingsReconciliation {
  nextHoldings: Holding[];
  changes: LedgerHoldingChange[];
  issues: LedgerHoldingIssue[];
  managedHoldingIds: string[];
  realizedGainAed: number;
}

export interface LedgerConnectionState {
  enabled: boolean;
  managedHoldingIds: string[];
}

const ASSET_ACTIVITY_TYPES = new Set(["buy", "sell", "split"]);

function nearlyEqual(first: number, second: number) {
  return Math.abs(first - second) <= QUANTITY_EPSILON;
}

function getAedRate(currency: Currency, inrToAedRate: number) {
  if (currency === "AED") return 1;
  if (currency === "USD") return USD_TO_AED_RATE;
  return inrToAedRate;
}

function sortLedgerTransactions(transactions: PortfolioTransaction[]) {
  const typeOrder: Record<string, number> = { buy: 0, split: 1, sell: 2 };
  return [...transactions].sort(
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

function purchaseSignature(purchase: Purchase) {
  return [purchase.date, purchase.quantity, purchase.price, purchase.fxRate || ""].join("|");
}

function purchasesMatch(first: Purchase[] | undefined, second: Purchase[]) {
  const firstSignatures = (first || []).map(purchaseSignature).sort();
  const secondSignatures = second.map(purchaseSignature).sort();
  return (
    firstSignatures.length === secondSignatures.length &&
    firstSignatures.every((signature, index) => signature === secondSignatures[index])
  );
}

export function reconcileHoldingsFromLedger(
  holdings: Holding[],
  transactions: PortfolioTransaction[],
  inrToAedRate: number,
  previouslyManagedHoldingIds: Iterable<string> = []
): LedgerHoldingsReconciliation {
  const holdingById = new Map(holdings.map((holding) => [holding.id, holding]));
  const linkedTransactions = new Map<string, PortfolioTransaction[]>();
  const issues: LedgerHoldingIssue[] = [];
  const managedHoldingIds = new Set(previouslyManagedHoldingIds);

  for (const transaction of transactions) {
    if (!ASSET_ACTIVITY_TYPES.has(transaction.type)) continue;

    if (!transaction.holdingId) {
      issues.push({
        transactionId: transaction.id,
        message: `${transaction.assetName || transaction.ticker || "An asset transaction"} must be linked to a holding.`,
      });
      continue;
    }

    const holding = holdingById.get(transaction.holdingId);
    if (!holding) {
      issues.push({
        transactionId: transaction.id,
        message: `${transaction.assetName || transaction.ticker || "A transaction"} is linked to a holding that no longer exists.`,
      });
      continue;
    }

    if (transaction.currency !== holding.currency) {
      issues.push({
        transactionId: transaction.id,
        message: `${holding.assetName} has a ${transaction.currency} transaction but the holding uses ${holding.currency}.`,
      });
      continue;
    }

    managedHoldingIds.add(holding.id);
    linkedTransactions.set(holding.id, [
      ...(linkedTransactions.get(holding.id) || []),
      transaction,
    ]);
  }

  const changes: LedgerHoldingChange[] = [];
  const nextById = new Map<string, Holding>();
  let realizedGainAed = 0;

  for (const holdingId of managedHoldingIds) {
    const holding = holdingById.get(holdingId);
    if (!holding) continue;

    let quantity = 0;
    let costBasis = 0;
    let realizedGain = 0;
    const purchases: Purchase[] = [];
    const holdingTransactions = sortLedgerTransactions(linkedTransactions.get(holdingId) || []);
    let holdingHasBlockingIssue = false;

    for (const transaction of holdingTransactions) {
      if (transaction.type === "buy") {
        const boughtQuantity = transaction.quantity || 0;
        const price = transaction.price || 0;
        quantity += boughtQuantity;
        costBasis += boughtQuantity * price + (transaction.fees || 0);
        purchases.push(purchaseFromTransaction(transaction));
        continue;
      }

      if (transaction.type === "sell") {
        const soldQuantity = transaction.quantity || 0;
        if (soldQuantity - quantity > QUANTITY_EPSILON) {
          issues.push({
            transactionId: transaction.id,
            message: `${holding.assetName} sells ${soldQuantity} but only ${quantity} is available on ${transaction.date}.`,
          });
          holdingHasBlockingIssue = true;
          continue;
        }

        const averageCost = quantity > QUANTITY_EPSILON ? costBasis / quantity : 0;
        realizedGain += ((transaction.price || 0) - averageCost) * soldQuantity - (transaction.fees || 0);
        quantity -= soldQuantity;
        costBasis -= averageCost * soldQuantity;

        if (quantity <= QUANTITY_EPSILON) {
          quantity = 0;
          costBasis = 0;
        }
        continue;
      }

      if (transaction.type === "split") {
        quantity *= transaction.splitRatio || 1;
      }
    }

    if (holdingHasBlockingIssue) continue;

    const averagePrice = quantity > QUANTITY_EPSILON ? costBasis / quantity : 0;
    const nextHolding: Holding = {
      ...holding,
      quantity,
      avgBuyPrice: averagePrice,
      purchases,
    };
    nextById.set(holdingId, nextHolding);
    realizedGainAed += realizedGain * getAedRate(holding.currency, inrToAedRate);

    if (
      !nearlyEqual(holding.quantity, quantity) ||
      !nearlyEqual(holding.avgBuyPrice, averagePrice) ||
      !purchasesMatch(holding.purchases, purchases)
    ) {
      changes.push({
        holdingId,
        assetName: holding.assetName,
        currency: holding.currency,
        currentQuantity: holding.quantity,
        nextQuantity: quantity,
        currentAveragePrice: holding.avgBuyPrice,
        nextAveragePrice: averagePrice,
        realizedGain,
      });
    }
  }

  return {
    nextHoldings: holdings.map((holding) => nextById.get(holding.id) || holding),
    changes,
    issues,
    managedHoldingIds: [...managedHoldingIds].filter((holdingId) => holdingById.has(holdingId)),
    realizedGainAed,
  };
}

export function loadLedgerConnectionState(userId: string): LedgerConnectionState {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(`${CONNECTION_STORAGE_PREFIX}${userId}`) || "null"
    ) as Partial<LedgerConnectionState> | null;
    return {
      enabled: parsed?.enabled === true,
      managedHoldingIds: Array.isArray(parsed?.managedHoldingIds)
        ? parsed.managedHoldingIds.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return { enabled: false, managedHoldingIds: [] };
  }
}

export function persistLedgerConnectionState(
  userId: string,
  state: LedgerConnectionState
) {
  localStorage.setItem(`${CONNECTION_STORAGE_PREFIX}${userId}`, JSON.stringify(state));
}
