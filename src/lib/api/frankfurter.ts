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
    const to = targets.join(',');
    const res = await fetch(
      `https://api.frankfurter.dev/latest?from=${base}&to=${to}`,
      { next: { revalidate: 3600 } } // Cache 1 hour
    );
    if (!res.ok) throw new Error(`Frankfurter error: ${res.status}`);
    const data: ExchangeRates = await res.json();
    return data;
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
