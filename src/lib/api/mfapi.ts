/**
 * Fetch latest Indian mutual-fund NAVs from AMFI's official daily feed.
 * MFAPI.in remains a per-scheme fallback when AMFI is unavailable or a
 * requested scheme is missing from the daily file.
 */

const AMFI_LATEST_NAV_URL = "https://portal.amfiindia.com/spages/NAVAll.txt";
const MFAPI_BASE_URL = "https://api.mfapi.in/mf";
const AMFI_REVALIDATE_SECONDS = 30 * 60;
const REQUEST_TIMEOUT_MS = 6_000;

export interface MFNavResult {
  schemeCode: string;
  schemeName: string;
  nav: number;
  date: string;
  previousNav?: number;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function uniqueSchemeCodes(schemeCodes: string[]) {
  return [...new Set(schemeCodes.map((code) => code.trim()).filter(Boolean))];
}

function parseNavDate(value: string) {
  const match = /^(\d{1,2})-([A-Za-z]{3}|\d{1,2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const monthNames = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
  ];
  const numericMonth = Number(match[2]);
  const month = Number.isFinite(numericMonth)
    ? numericMonth - 1
    : monthNames.indexOf(match[2].toLowerCase());
  const timestamp = Date.UTC(Number(match[3]), month, Number(match[1]));

  return month >= 0 && month <= 11 && Number.isFinite(timestamp) ? timestamp : null;
}

export function selectPreviousNav(
  entries: Array<{ date?: unknown; nav?: unknown }>,
  latestDate: string
) {
  const latestTimestamp = parseNavDate(latestDate);
  if (latestTimestamp === null) return undefined;

  return entries
    .map((entry) => ({
      timestamp: typeof entry.date === "string" ? parseNavDate(entry.date) : null,
      nav: Number.parseFloat(String(entry.nav ?? "")),
    }))
    .filter(
      (entry) =>
        entry.timestamp !== null &&
        entry.timestamp < latestTimestamp &&
        Number.isFinite(entry.nav) &&
        entry.nav > 0
    )
    .sort((left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0))[0]?.nav;
}

function formatIsoDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

async function fetchPreviousMfapiNav(schemeCode: string, latestDate: string) {
  const latestTimestamp = parseNavDate(latestDate);
  if (latestTimestamp === null) return undefined;

  const startDate = formatIsoDate(latestTimestamp - 14 * 24 * 60 * 60 * 1000);
  const endDate = formatIsoDate(latestTimestamp);
  const response = await fetch(
    `${MFAPI_BASE_URL}/${schemeCode}?startDate=${startDate}&endDate=${endDate}`,
    {
      next: { revalidate: 30 * 60 },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error(`MFAPI history error: ${response.status}`);
  }

  const data = await response.json();
  return selectPreviousNav(Array.isArray(data?.data) ? data.data : [], latestDate);
}

/** Parse both AMFI's current feed and its legacy six-column format. */
export function parseAmfiNavFeed(feed: string, schemeCodes: string[]): MFNavResult[] {
  const requested = new Set(uniqueSchemeCodes(schemeCodes));
  if (!requested.size) return [];

  let schemeCodeIndex = -1;
  let schemeNameIndex = -1;
  let navIndex = -1;
  let dateIndex = -1;
  let planIndex = -1;
  let optionIndex = -1;
  const results = new Map<string, MFNavResult>();

  for (const rawLine of feed.split(/\r?\n/)) {
    const columns = rawLine.split(";").map((column) => column.trim());

    if (schemeCodeIndex === -1 && columns[0]?.replace(/^\uFEFF/, "") === "Scheme Code") {
      columns[0] = columns[0].replace(/^\uFEFF/, "");
      schemeCodeIndex = columns.indexOf("Scheme Code");
      schemeNameIndex = columns.indexOf("Scheme Name");
      navIndex = columns.indexOf("Net Asset Value");
      dateIndex = columns.indexOf("Date");
      planIndex = columns.indexOf("Plan");
      optionIndex = columns.indexOf("Option");
      continue;
    }

    if (schemeCodeIndex < 0 || schemeNameIndex < 0 || navIndex < 0 || dateIndex < 0) {
      continue;
    }

    const schemeCode = columns[schemeCodeIndex];
    if (!requested.has(schemeCode)) continue;

    const nav = Number.parseFloat(columns[navIndex]);
    const date = columns[dateIndex];
    if (!Number.isFinite(nav) || nav <= 0 || !date) continue;

    const schemeName = [
      columns[schemeNameIndex],
      planIndex >= 0 ? columns[planIndex] : "",
      optionIndex >= 0 ? columns[optionIndex] : "",
    ]
      .filter(Boolean)
      .join(" - ");

    results.set(schemeCode, { schemeCode, schemeName, nav, date });
  }

  return schemeCodes.flatMap((code) => {
    const result = results.get(code.trim());
    return result ? [result] : [];
  });
}

async function fetchAmfiNav(schemeCodes: string[]) {
  const response = await fetch(AMFI_LATEST_NAV_URL, {
    next: { revalidate: AMFI_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`AMFI error: ${response.status}`);
  }

  return parseAmfiNavFeed(await response.text(), schemeCodes);
}

async function fetchMfapiNav(schemeCode: string): Promise<MFNavResult> {
  const response = await fetch(`${MFAPI_BASE_URL}/${schemeCode}/latest`, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`MFAPI error: ${response.status}`);
  }

  const data = await response.json();
  const latest = data?.data?.[0];
  const nav = Number.parseFloat(latest?.nav);

  if (!Number.isFinite(nav) || nav <= 0 || !latest?.date) {
    throw new Error("MFAPI returned an invalid NAV response");
  }

  return {
    schemeCode,
    schemeName: data.meta?.scheme_name || "",
    nav,
    date: latest.date,
  };
}

export async function fetchMutualFundNav(schemeCodes: string[]): Promise<MFNavResult[]> {
  const requestedCodes = uniqueSchemeCodes(schemeCodes);
  if (!requestedCodes.length) return [];

  let results: MFNavResult[] = [];

  try {
    results = await fetchAmfiNav(requestedCodes);
  } catch (error) {
    console.warn(`[prices/indian-mf] AMFI feed unavailable: ${errorMessage(error)}`);
  }

  const foundCodes = new Set(results.map((result) => result.schemeCode));
  const missingCodes = requestedCodes.filter((code) => !foundCodes.has(code));

  if (missingCodes.length) {
    const fallbackResults = await Promise.all(
      missingCodes.map(async (code) => {
        try {
          return await fetchMfapiNav(code);
        } catch (error) {
          console.warn(
            `[prices/indian-mf] NAV unavailable for scheme ${code}: ${errorMessage(error)}`
          );
          return null;
        }
      })
    );

    results = [...results, ...fallbackResults.filter((result): result is MFNavResult => result !== null)];
  }

  if (!results.length) {
    throw new Error("Unable to fetch mutual-fund NAVs from AMFI or MFAPI");
  }

  results = await Promise.all(
    results.map(async (result) => {
      try {
        return {
          ...result,
          previousNav: await fetchPreviousMfapiNav(result.schemeCode, result.date),
        };
      } catch (error) {
        console.warn(
          `[prices/indian-mf] Previous NAV unavailable for scheme ${result.schemeCode}: ${errorMessage(error)}`
        );
        return result;
      }
    })
  );

  const resultsByCode = new Map(results.map((result) => [result.schemeCode, result]));
  return requestedCodes.flatMap((code) => {
    const result = resultsByCode.get(code);
    return result ? [result] : [];
  });
}
