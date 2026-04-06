import { USD_TO_AED, type ComputedHolding, type Currency, type Holding } from './constants';

/**
 * Format a number as money in the given currency.
 */
export function formatMoney(value: number, currency: Currency = 'AED'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

/**
 * Safely parse a value to a finite number.
 */
export function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Get the conversion rate from a given currency to AED.
 */
export function getAedRate(currency: Currency, inrToAedRate: number): number {
  if (currency === 'AED') return 1;
  if (currency === 'USD') return USD_TO_AED;
  if (currency === 'INR') return inrToAedRate;
  return 1;
}

/**
 * Compute derived values for a holding.
 */
export function computeHolding(holding: Holding, inrToAedRate: number): ComputedHolding {
  const quantity = toNumber(holding.quantity);
  const avgBuyPrice = toNumber(holding.avgBuyPrice);
  const currentPrice = toNumber(holding.currentPrice);
  const rateToAed = getAedRate(holding.currency, inrToAedRate);

  const investedAmount = quantity * avgBuyPrice;
  const currentValue = quantity * currentPrice;
  const gainLoss = currentValue - investedAmount;
  const gainLossPct = investedAmount ? (gainLoss / investedAmount) * 100 : 0;

  return {
    ...holding,
    quantity,
    avgBuyPrice,
    currentPrice,
    rateToAed,
    investedAmount,
    currentValue,
    gainLoss,
    gainLossPct,
    investedAmountAed: investedAmount * rateToAed,
    currentValueAed: currentValue * rateToAed,
    gainLossAed: gainLoss * rateToAed,
  };
}

/**
 * Generate a unique ID.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Compute portfolio-level allocation by a given key.
 */
export function getAllocation(
  holdings: ComputedHolding[],
  key: keyof ComputedHolding,
  totalValue: number
): { label: string; value: number; weight: number }[] {
  const tv = totalValue || 1;
  const grouped = holdings.reduce<Record<string, number>>((acc, item) => {
    const label = String(item[key]) || 'Uncategorized';
    acc[label] = (acc[label] || 0) + item.currentValueAed;
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([label, value]) => ({ label, value, weight: (value / tv) * 100 }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Compact number format (e.g., 1.2K, 3.4M).
 */
export function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format a relative time since a given ISO string.
 */
export function timeAgo(isoString: string | undefined): string {
  if (!isoString) return 'Never';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}
