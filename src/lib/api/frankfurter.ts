/**
 * Frankfurter API — free, no key required.
 * Used for currency exchange rates.
 */

export interface ExchangeRates {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export async function fetchExchangeRates(
  base: string = 'AED',
  targets: string[] = ['USD', 'INR']
): Promise<ExchangeRates | null> {
  try {
    const quotes = targets.join(',');
    const res = await fetch(
      `https://api.frankfurter.dev/v2/rates?base=${base}&quotes=${quotes}`,
      { next: { revalidate: 3600 } } // Cache 1 hour
    );
    if (!res.ok) throw new Error(`Frankfurter error: ${res.status}`);
    const rows = (await res.json()) as Array<{ date: string; base: string; quote: string; rate: number }>;

    return {
      base,
      date: rows[0]?.date || new Date().toISOString().slice(0, 10),
      rates: rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.quote] = row.rate;
        return acc;
      }, {}),
    };
  } catch (err) {
    console.error('Frankfurter: failed to fetch exchange rates:', err);
    return null;
  }
}

/**
 * Compute INR → AED rate from Frankfurter response.
 * Frankfurter gives AED → INR, so we invert.
 */
export function computeInrToAed(rates: ExchangeRates | null): number {
  if (!rates?.rates?.INR) return 0.044; // fallback
  return 1 / rates.rates.INR;
}
