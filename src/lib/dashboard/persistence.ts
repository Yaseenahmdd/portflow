import { DEFAULT_HOLDINGS, type Holding } from "@/lib/constants";
import { normalizeHoldings } from "@/lib/holdings-normalize";
import { fetchRemoteHoldings, replaceRemoteHoldings } from "@/lib/holdings-store";
import { createClient } from "@/lib/supabase/client";

export const DEFAULT_INR_TO_AED_RATE = 0.044;

export function getHoldingsStorageKey(userId: string) {
  return `portflow-holdings-${userId}`;
}

export function getRateStorageKey(userId: string) {
  return `portflow-inr-aed-rate-${userId}`;
}

function parseStoredHoldings(raw: string | null): Holding[] | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Holding[];
    return normalizeHoldings(parsed).normalized;
  } catch {
    return null;
  }
}

function parseStoredRate(raw: string | null) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INR_TO_AED_RATE;
}

export async function loadDashboardPersistenceState() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id || "default";
  const storedHoldings = parseStoredHoldings(localStorage.getItem(getHoldingsStorageKey(userId)));
  const inrToAedRate = parseStoredRate(localStorage.getItem(getRateStorageKey(userId)));

  try {
    const remoteHoldings = await fetchRemoteHoldings(supabase, userId);

    if (remoteHoldings && remoteHoldings.length > 0) {
      const { normalized, changed } = normalizeHoldings(remoteHoldings);
      persistLocalHoldings(userId, normalized);

      if (changed) {
        await replaceRemoteHoldings(supabase, userId, normalized);
      }

      return { userId, holdings: normalized, inrToAedRate };
    }

    if (storedHoldings) {
      persistLocalHoldings(userId, storedHoldings);
      await replaceRemoteHoldings(supabase, userId, storedHoldings);
      return { userId, holdings: storedHoldings, inrToAedRate };
    }
  } catch {
    if (storedHoldings) {
      return { userId, holdings: storedHoldings, inrToAedRate };
    }
  }

  return { userId, holdings: DEFAULT_HOLDINGS, inrToAedRate };
}

export function persistLocalHoldings(userId: string, holdings: Holding[]) {
  localStorage.setItem(getHoldingsStorageKey(userId), JSON.stringify(holdings));
}

export function persistDashboardRate(userId: string, inrToAedRate: number) {
  localStorage.setItem(getRateStorageKey(userId), String(inrToAedRate));
}

export async function syncRemoteHoldings(userId: string, holdings: Holding[]) {
  const supabase = createClient();
  await replaceRemoteHoldings(supabase, userId, holdings);
}
