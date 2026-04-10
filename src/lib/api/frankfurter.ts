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
): Promise<ExchangeRates | null> {
  try {
    // AED is pegged to USD (1 USD = 3.6725 AED). We fetch USD to INR.
    const res = await fetch(`https://api.frankfurter.app/latest?from=USD&to=INR`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`Frankfurter error: ${res.status}`);
    const data: ExchangeRates = await res.json();
    
    // Process Rates to simulate AED base
    const inrPerUsd = data.rates.INR;
    const inrPerAed = inrPerUsd / 3.6725;
    
    const convertedData: ExchangeRates = {
      base: 'AED',
      date: data.date,
      rates: { INR: inrPerAed },
    };
    return convertedData;
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
