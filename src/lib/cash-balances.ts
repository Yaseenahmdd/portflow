import type { Currency, Holding } from "@/lib/constants";
import type { PortfolioTransaction } from "@/lib/transactions";

const USD_TO_AED_RATE = 3.6725;
const IMPORTED_PURCHASE_PREFIX = "holding-import-";

export interface CashAccountBalance {
  key: string;
  platform: string;
  currency: Currency;
  balance: number;
  balanceAed: number;
  activityCount: number;
  excludedHistoricalBuys: number;
  includedInNetWorth: boolean;
  isNegative: boolean;
}

export interface CashBalanceSummary {
  accounts: CashAccountBalance[];
  totalCashAed: number;
  negativeAccounts: CashAccountBalance[];
  excludedHistoricalBuys: number;
}

interface MutableCashAccount {
  platform: string;
  currency: Currency;
  balance: number;
  activityCount: number;
  excludedHistoricalBuys: number;
}

function normalizePlatform(platform: string) {
  return platform.trim() || "Unassigned";
}

function accountKey(platform: string, currency: Currency) {
  return `${normalizePlatform(platform).toLowerCase()}|${currency}`;
}

function getAedRate(currency: Currency, inrToAedRate: number) {
  if (currency === "AED") return 1;
  if (currency === "USD") return USD_TO_AED_RATE;
  return inrToAedRate;
}

function isHistoricalImportedBuy(transaction: PortfolioTransaction) {
  return transaction.type === "buy" && transaction.id.startsWith(IMPORTED_PURCHASE_PREFIX);
}

export function getCashBalances(
  transactions: PortfolioTransaction[],
  holdings: Holding[],
  inrToAedRate: number
): CashBalanceSummary {
  const accounts = new Map<string, MutableCashAccount>();

  function updateAccount(
    platform: string,
    currency: Currency,
    amount: number,
    options: { excludedHistoricalBuy?: boolean } = {}
  ) {
    const normalizedPlatform = normalizePlatform(platform);
    const key = accountKey(normalizedPlatform, currency);
    const current = accounts.get(key) || {
      platform: normalizedPlatform,
      currency,
      balance: 0,
      activityCount: 0,
      excludedHistoricalBuys: 0,
    };

    current.activityCount += 1;
    if (options.excludedHistoricalBuy) {
      current.excludedHistoricalBuys += 1;
    } else {
      current.balance += amount;
    }
    accounts.set(key, current);
  }

  for (const transaction of transactions) {
    if (transaction.type === "split") continue;

    if (isHistoricalImportedBuy(transaction)) {
      updateAccount(transaction.platform, transaction.currency, 0, {
        excludedHistoricalBuy: true,
      });
      continue;
    }

    if (transaction.type === "buy") {
      const cost = (transaction.quantity || 0) * (transaction.price || 0) + (transaction.fees || 0);
      updateAccount(transaction.platform, transaction.currency, -cost);
      continue;
    }

    if (transaction.type === "sell") {
      const proceeds = (transaction.quantity || 0) * (transaction.price || 0) - (transaction.fees || 0);
      updateAccount(transaction.platform, transaction.currency, proceeds);
      continue;
    }

    if (transaction.type === "deposit" || transaction.type === "dividend") {
      updateAccount(transaction.platform, transaction.currency, transaction.amount || 0);
      continue;
    }

    if (transaction.type === "withdrawal" || transaction.type === "fee") {
      updateAccount(transaction.platform, transaction.currency, -(transaction.amount || 0));
      continue;
    }

    if (transaction.type === "fx") {
      updateAccount(transaction.platform, transaction.currency, -(transaction.amount || 0));
      if (transaction.targetCurrency) {
        updateAccount(transaction.platform, transaction.targetCurrency, transaction.targetAmount || 0);
      }
    }
  }

  const representedAccounts = new Set(
    holdings
      .filter((holding) => holding.assetClass === "Cash")
      .map((holding) => accountKey(holding.platform, holding.currency))
  );

  const resolvedAccounts = [...accounts.entries()]
    .map<CashAccountBalance>(([key, account]) => {
      const includedInNetWorth = !representedAccounts.has(key);
      return {
        key,
        platform: account.platform,
        currency: account.currency,
        balance: account.balance,
        balanceAed: account.balance * getAedRate(account.currency, inrToAedRate),
        activityCount: account.activityCount,
        excludedHistoricalBuys: account.excludedHistoricalBuys,
        includedInNetWorth,
        isNegative: account.balance < 0,
      };
    })
    .sort((first, second) =>
      first.platform.localeCompare(second.platform) || first.currency.localeCompare(second.currency)
    );
  const visibleAccounts = resolvedAccounts.filter(
    (account) => account.balance !== 0 || account.activityCount > account.excludedHistoricalBuys
  );

  return {
    accounts: visibleAccounts,
    totalCashAed: resolvedAccounts.reduce(
      (sum, account) => sum + (account.includedInNetWorth ? account.balanceAed : 0),
      0
    ),
    negativeAccounts: visibleAccounts.filter((account) => account.isNegative),
    excludedHistoricalBuys: resolvedAccounts.reduce(
      (sum, account) => sum + account.excludedHistoricalBuys,
      0
    ),
  };
}
