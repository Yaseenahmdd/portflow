import { DEFAULT_HOLDINGS, type Holding } from "@/lib/constants";
import { normalizeHoldings } from "@/lib/holdings-normalize";
import { fetchRemoteHoldings, upsertRemoteHoldings, deleteRemoteHolding } from "@/lib/holdings-store";
import { createClient } from "@/lib/supabase/client";

export const DEFAULT_INR_TO_AED_RATE = 0.044;
export const DEFAULT_FX_UPDATED_AT: string | null = null;

export function getHoldingsStorageKey(userId: string) {
  return `portflow-holdings-${userId}`;
}

export function getRateStorageKey(userId: string) {
  return `portflow-inr-aed-rate-${userId}`;
}

export function getFxUpdatedAtStorageKey(userId: string) {
  return `portflow-inr-aed-rate-updated-at-${userId}`;
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

function parseStoredTimestamp(raw: string | null) {
  if (!raw) {
    return DEFAULT_FX_UPDATED_AT;
  }

  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : DEFAULT_FX_UPDATED_AT;
}

export async function loadDashboardPersistenceState() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id || "default";
  const storedHoldings = parseStoredHoldings(localStorage.getItem(getHoldingsStorageKey(userId)));
  const inrToAedRate = parseStoredRate(localStorage.getItem(getRateStorageKey(userId)));
  const fxUpdatedAt = parseStoredTimestamp(localStorage.getItem(getFxUpdatedAtStorageKey(userId)));

  try {
    const remoteHoldings = await fetchRemoteHoldings(supabase, userId);

    if (remoteHoldings && remoteHoldings.length > 0) {
      const { normalized, changed } = normalizeHoldings(remoteHoldings);
      persistLocalHoldings(userId, normalized);

      if (changed) {
        await upsertRemoteHoldings(supabase, userId, normalized);
      }

      return { userId, holdings: normalized, inrToAedRate, fxUpdatedAt };
    }

    if (storedHoldings) {
      persistLocalHoldings(userId, storedHoldings);
      await upsertRemoteHoldings(supabase, userId, storedHoldings);
      return { userId, holdings: storedHoldings, inrToAedRate, fxUpdatedAt };
    }
  } catch {
    if (storedHoldings) {
      return { userId, holdings: storedHoldings, inrToAedRate, fxUpdatedAt };
    }
  }

  if (storedHoldings) {
    return { userId, holdings: storedHoldings, inrToAedRate, fxUpdatedAt };
  }

  return { userId, holdings: DEFAULT_HOLDINGS, inrToAedRate, fxUpdatedAt };
}

export function persistLocalHoldings(userId: string, holdings: Holding[]) {
  localStorage.setItem(getHoldingsStorageKey(userId), JSON.stringify(holdings));
}

export function persistDashboardRate(userId: string, inrToAedRate: number) {
  localStorage.setItem(getRateStorageKey(userId), String(inrToAedRate));
}

export function persistFxUpdatedAt(userId: string, fxUpdatedAt: string | null) {
  if (!fxUpdatedAt) {
    localStorage.removeItem(getFxUpdatedAtStorageKey(userId));
    return;
  }

  localStorage.setItem(getFxUpdatedAtStorageKey(userId), fxUpdatedAt);
}

export async function syncDashboardHoldingsFromRemote(userId: string) {
  const supabase = createClient();
  const remoteHoldings = await fetchRemoteHoldings(supabase, userId);

  if (!remoteHoldings) {
    return null;
  }

  const { normalized, changed } = normalizeHoldings(remoteHoldings);

  if (changed) {
    await upsertRemoteHoldings(supabase, userId, normalized);
  }

  return normalized;
}

export async function upsertRemoteHoldingsState(userId: string, holdings: Holding[]) {
  const supabase = createClient();
  await upsertRemoteHoldings(supabase, userId, holdings);
}

export async function deleteRemoteHoldingState(userId: string, id: string) {
  const supabase = createClient();
  await deleteRemoteHolding(supabase, userId, id);
}
