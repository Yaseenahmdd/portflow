/**
 * Fetch latest NAV from MFAPI.in (no API key required).
 * Returns { schemeCode, nav, date } for each requested scheme.
 */

export interface MFNavResult {
  schemeCode: string;
  schemeName: string;
  nav: number;
  date: string;
}

export async function fetchMutualFundNav(schemeCodes: string[]): Promise<MFNavResult[]> {
  const results: MFNavResult[] = [];

  const fetches = schemeCodes.map(async (code) => {
    try {
      const res = await fetch(`https://api.mfapi.in/mf/${code}/latest`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`MFAPI error: ${res.status}`);
      const data = await res.json();

      if (data?.data?.[0]) {
        results.push({
          schemeCode: code,
          schemeName: data.meta?.scheme_name || '',
          nav: parseFloat(data.data[0].nav),
          date: data.data[0].date,
        });
      }
    } catch (err) {
      console.error(`Failed to fetch NAV for scheme ${code}:`, err);
    }
  });

  await Promise.allSettled(fetches);
  return results;
}
