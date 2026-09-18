import type { Currency, Holding } from "@/lib/constants";

export const TRANSACTION_TYPES = [
  "buy",
  "sell",
  "dividend",
  "deposit",
  "withdrawal",
  "fee",
  "split",
  "fx",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  buy: "Buy",
  sell: "Sell",
  dividend: "Dividend",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  fee: "Fee",
  split: "Stock split",
  fx: "Currency exchange",
};

export interface PortfolioTransaction {
  id: string;
  type: TransactionType;
  date: string;
  holdingId?: string;
  platform: string;
  assetName: string;
  ticker: string;
  currency: Currency;
  quantity?: number;
  price?: number;
  amount?: number;
  fees?: number;
  fxRateToAed?: number;
  targetCurrency?: Currency;
  targetAmount?: number;
  splitRatio?: number;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCIES = new Set<Currency>(["AED", "USD", "INR"]);
const TYPES = new Set<TransactionType>(TRANSACTION_TYPES);

function isNonNegativeOptionalNumber(value: unknown) {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function isPositiveOptionalNumber(value: unknown) {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value > 0);
}

export function normalizeTransaction(transaction: PortfolioTransaction): PortfolioTransaction {
  return {
    ...transaction,
    holdingId: transaction.holdingId?.trim() || undefined,
    platform: transaction.platform.trim(),
    assetName: transaction.assetName.trim(),
    ticker: transaction.ticker.trim().toUpperCase(),
    notes: transaction.notes.trim(),
  };
}

export function isPortfolioTransaction(value: unknown): value is PortfolioTransaction {
  if (!value || typeof value !== "object") return false;
  const transaction = value as Partial<PortfolioTransaction>;

  return (
    typeof transaction.id === "string" &&
    transaction.id.length > 0 &&
    typeof transaction.type === "string" &&
    TYPES.has(transaction.type as TransactionType) &&
    typeof transaction.date === "string" &&
    DATE_PATTERN.test(transaction.date) &&
    typeof transaction.platform === "string" &&
    typeof transaction.assetName === "string" &&
    typeof transaction.ticker === "string" &&
    typeof transaction.currency === "string" &&
    CURRENCIES.has(transaction.currency as Currency) &&
    typeof transaction.notes === "string" &&
    (transaction.holdingId === undefined || typeof transaction.holdingId === "string") &&
    isPositiveOptionalNumber(transaction.quantity) &&
    isNonNegativeOptionalNumber(transaction.price) &&
    isNonNegativeOptionalNumber(transaction.amount) &&
    isNonNegativeOptionalNumber(transaction.fees) &&
    isPositiveOptionalNumber(transaction.fxRateToAed) &&
    (transaction.targetCurrency === undefined || CURRENCIES.has(transaction.targetCurrency)) &&
    isPositiveOptionalNumber(transaction.targetAmount) &&
    isPositiveOptionalNumber(transaction.splitRatio)
  );
}

export function validateTransaction(transaction: PortfolioTransaction) {
  if (!DATE_PATTERN.test(transaction.date)) return "Choose a valid transaction date.";
  if (!transaction.platform.trim()) return "Enter a platform or account.";

  if (["buy", "sell"].includes(transaction.type)) {
    if (!transaction.holdingId && !transaction.assetName.trim()) return "Choose or name an asset.";
    if (!transaction.quantity || transaction.quantity <= 0) return "Enter a quantity greater than zero.";
    if (transaction.price === undefined || transaction.price < 0) return "Enter a valid unit price.";
  }

  if (transaction.type === "dividend") {
    if (!transaction.holdingId && !transaction.assetName.trim()) return "Choose or name the income source.";
    if (!transaction.amount || transaction.amount <= 0) return "Enter a dividend amount greater than zero.";
  }

  if (["deposit", "withdrawal", "fee"].includes(transaction.type)) {
    if (!transaction.amount || transaction.amount <= 0) return "Enter an amount greater than zero.";
  }

  if (transaction.type === "split") {
    if (!transaction.holdingId && !transaction.assetName.trim()) return "Choose the split asset.";
    if (!transaction.splitRatio || transaction.splitRatio <= 0) return "Enter a split ratio greater than zero.";
  }

  if (transaction.type === "fx") {
    if (!transaction.amount || transaction.amount <= 0) return "Enter the amount exchanged.";
    if (!transaction.targetAmount || transaction.targetAmount <= 0) return "Enter the amount received.";
    if (!transaction.targetCurrency || transaction.targetCurrency === transaction.currency) {
      return "Choose a different target currency.";
    }
  }

  if ((transaction.fees || 0) < 0) return "Fees cannot be negative.";
  return null;
}

export function getTransactionAmount(transaction: PortfolioTransaction) {
  if (transaction.type === "buy" || transaction.type === "sell") {
    return (transaction.quantity || 0) * (transaction.price || 0) + (transaction.fees || 0);
  }
  return transaction.amount || 0;
}

export function transactionFromHolding(
  transaction: PortfolioTransaction,
  holding: Holding
): PortfolioTransaction {
  return {
    ...transaction,
    holdingId: holding.id,
    platform: holding.platform,
    assetName: holding.assetName,
    ticker: holding.ticker,
    currency: holding.currency,
  };
}

function deterministicImportHash(value: string) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }

  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

function isImportablePurchase(purchase: NonNullable<Holding["purchases"]>[number]) {
  return (
    DATE_PATTERN.test(purchase.date) &&
    Number.isFinite(purchase.quantity) &&
    purchase.quantity > 0 &&
    Number.isFinite(purchase.price) &&
    purchase.price >= 0 &&
    (purchase.fxRate === undefined ||
      (Number.isFinite(purchase.fxRate) && purchase.fxRate > 0))
  );
}

export function transactionsFromHoldingPurchases(holdings: Holding[]) {
  const transactions: PortfolioTransaction[] = [];

  for (const holding of holdings) {
    const signatureOccurrences = new Map<string, number>();

    for (const purchase of holding.purchases || []) {
      if (!isImportablePurchase(purchase)) continue;

      const signature = [
        holding.id,
        purchase.date,
        purchase.quantity,
        purchase.price,
        holding.currency === "INR" ? purchase.fxRate || "" : "",
      ].join("|");
      const occurrence = signatureOccurrences.get(signature) || 0;
      signatureOccurrences.set(signature, occurrence + 1);

      transactions.push({
        id: `holding-import-${deterministicImportHash(`${signature}|${occurrence}`)}`,
        type: "buy",
        date: purchase.date,
        holdingId: holding.id,
        platform: holding.platform,
        assetName: holding.assetName,
        ticker: holding.ticker,
        currency: holding.currency,
        quantity: purchase.quantity,
        price: purchase.price,
        fxRateToAed: holding.currency === "INR" ? purchase.fxRate : undefined,
        notes: "Imported from existing holding purchase history.",
      });
    }
  }

  return transactions;
}
