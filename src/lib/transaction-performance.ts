import type { PortfolioTransaction } from "@/lib/transactions";

const USD_TO_AED_RATE = 3.6725;
const QUANTITY_EPSILON = 1e-9;

interface AssetCostState {
  quantity: number;
  costBasis: number;
}

export interface TransactionIncomeSource {
  key: string;
  name: string;
  amountAed: number;
  count: number;
}

export interface TransactionPerformance {
  realizedGainAed: number;
  soldCostBasisAed: number;
  dividendIncomeAed: number;
  standaloneFeesAed: number;
  tradeFeesAed: number;
  totalFeesAed: number;
  depositsAed: number;
  withdrawalsAed: number;
  netCashFlowAed: number;
  incomeSources: TransactionIncomeSource[];
  issues: string[];
  activityCount: number;
}

interface TransactionPerformanceOptions {
  startDate?: string | null;
  endDate?: string | null;
  inrToAedRate: number;
}

function rateToAed(transaction: PortfolioTransaction, fallbackInrRate: number) {
  if (transaction.currency === "AED") return 1;
  if (transaction.currency === "USD") return USD_TO_AED_RATE;
  return transaction.fxRateToAed || fallbackInrRate;
}

function isInsideRange(
  transaction: PortfolioTransaction,
  startDate?: string | null,
  endDate?: string | null
) {
  return (!startDate || transaction.date >= startDate) && (!endDate || transaction.date <= endDate);
}

function assetKey(transaction: PortfolioTransaction) {
  if (transaction.holdingId) return `holding:${transaction.holdingId}`;
  return [
    "asset",
    transaction.platform.trim().toLowerCase(),
    transaction.ticker.trim().toUpperCase(),
    transaction.assetName.trim().toLowerCase(),
    transaction.currency,
  ].join(":");
}

function sortTransactions(transactions: PortfolioTransaction[]) {
  const typeOrder: Record<string, number> = { buy: 0, split: 1, sell: 2 };
  return [...transactions].sort(
    (first, second) =>
      first.date.localeCompare(second.date) ||
      (first.createdAt || "").localeCompare(second.createdAt || "") ||
      (typeOrder[first.type] ?? 3) - (typeOrder[second.type] ?? 3) ||
      first.id.localeCompare(second.id)
  );
}

function transactionAmount(transaction: PortfolioTransaction) {
  if (transaction.type === "buy" || transaction.type === "sell") {
    return (transaction.quantity || 0) * (transaction.price || 0);
  }
  return transaction.amount || 0;
}

export function getTransactionPerformance(
  transactions: PortfolioTransaction[],
  { startDate, endDate, inrToAedRate }: TransactionPerformanceOptions
): TransactionPerformance {
  const states = new Map<string, AssetCostState>();
  const incomeBySource = new Map<string, TransactionIncomeSource>();
  const issues: string[] = [];
  let realizedGainAed = 0;
  let soldCostBasisAed = 0;
  let dividendIncomeAed = 0;
  let standaloneFeesAed = 0;
  let tradeFeesAed = 0;
  let depositsAed = 0;
  let withdrawalsAed = 0;
  let activityCount = 0;

  for (const transaction of sortTransactions(transactions)) {
    if (endDate && transaction.date > endDate) continue;

    const inRange = isInsideRange(transaction, startDate, endDate);
    const conversionRate = rateToAed(transaction, inrToAedRate);
    const key = assetKey(transaction);
    const state = states.get(key) || { quantity: 0, costBasis: 0 };

    if (transaction.type === "buy") {
      const quantity = transaction.quantity || 0;
      state.quantity += quantity;
      state.costBasis += transactionAmount(transaction) + (transaction.fees || 0);
      states.set(key, state);
      if (inRange) {
        activityCount += 1;
        tradeFeesAed += (transaction.fees || 0) * conversionRate;
      }
      continue;
    }

    if (transaction.type === "sell") {
      const quantity = transaction.quantity || 0;
      if (quantity - state.quantity > QUANTITY_EPSILON) {
        issues.push(
          `${transaction.assetName || transaction.ticker || "An asset"} sells more than the recorded quantity on ${transaction.date}.`
        );
        continue;
      }

      const averageCost = state.quantity > QUANTITY_EPSILON ? state.costBasis / state.quantity : 0;
      const soldCost = averageCost * quantity;
      if (inRange) {
        realizedGainAed +=
          ((transaction.price || 0) * quantity - soldCost - (transaction.fees || 0)) * conversionRate;
        soldCostBasisAed += soldCost * conversionRate;
        tradeFeesAed += (transaction.fees || 0) * conversionRate;
        activityCount += 1;
      }
      state.quantity -= quantity;
      state.costBasis -= soldCost;
      if (state.quantity <= QUANTITY_EPSILON) {
        state.quantity = 0;
        state.costBasis = 0;
      }
      states.set(key, state);
      continue;
    }

    if (transaction.type === "split") {
      state.quantity *= transaction.splitRatio || 1;
      states.set(key, state);
      if (inRange) activityCount += 1;
      continue;
    }

    if (!inRange) continue;
    activityCount += 1;
    const amountAed = transactionAmount(transaction) * conversionRate;

    if (transaction.type === "dividend") {
      dividendIncomeAed += amountAed;
      const sourceKey = transaction.holdingId || key;
      const existing = incomeBySource.get(sourceKey);
      incomeBySource.set(sourceKey, {
        key: sourceKey,
        name: transaction.assetName || transaction.ticker || "Other income",
        amountAed: (existing?.amountAed || 0) + amountAed,
        count: (existing?.count || 0) + 1,
      });
    }

    if (transaction.type === "fee") standaloneFeesAed += amountAed;
    if (transaction.type === "deposit") depositsAed += amountAed;
    if (transaction.type === "withdrawal") withdrawalsAed += amountAed;
  }

  return {
    realizedGainAed,
    soldCostBasisAed,
    dividendIncomeAed,
    standaloneFeesAed,
    tradeFeesAed,
    totalFeesAed: standaloneFeesAed + tradeFeesAed,
    depositsAed,
    withdrawalsAed,
    netCashFlowAed: depositsAed - withdrawalsAed,
    incomeSources: [...incomeBySource.values()].sort((first, second) => second.amountAed - first.amountAed),
    issues,
    activityCount,
  };
}
