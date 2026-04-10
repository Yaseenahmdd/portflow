import { createClient } from "@/lib/supabase/client";

export interface PortfolioSnapshot {
  snapshotDate: string;
  totalValueAed: number;
  totalInvestedAed: number;
  totalGainLossAed: number;
  holdingsCount: number;
  createdAt?: string;
  updatedAt?: string;
}

interface PortfolioSnapshotRow {
  user_id: string;
  snapshot_date: string;
  total_value_aed: number;
  total_invested_aed: number;
  total_gain_loss_aed: number;
  holdings_count: number;
  created_at: string | null;
  updated_at: string | null;
}

type PortfolioSnapshotUpsertRow = Omit<PortfolioSnapshotRow, "created_at" | "updated_at">;

type SupabaseLikeClient = {
  from?: (table: string) => {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, options?: { ascending?: boolean }) => Promise<{ data: PortfolioSnapshotRow[] | null; error: { message: string } | null }>;
      };
    };
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
    upsert: (
      values: PortfolioSnapshotUpsertRow[],
      options?: { onConflict?: string }
    ) => Promise<{ error: { message: string } | null }>;
  };
};

const SNAPSHOT_STORAGE_PREFIX = "portflow-snapshots-";

function hasDatabaseClient(client: unknown): client is Required<SupabaseLikeClient> {
  return typeof client === "object" && client !== null && typeof (client as SupabaseLikeClient).from === "function";
}

function getSnapshotStorageKey(userId: string) {
  return `${SNAPSHOT_STORAGE_PREFIX}${userId}`;
}

function mapRowToSnapshot(row: PortfolioSnapshotRow): PortfolioSnapshot {
  return {
    snapshotDate: row.snapshot_date,
    totalValueAed: row.total_value_aed,
    totalInvestedAed: row.total_invested_aed,
    totalGainLossAed: row.total_gain_loss_aed,
    holdingsCount: row.holdings_count,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

function mapSnapshotToRow(userId: string, snapshot: PortfolioSnapshot): PortfolioSnapshotUpsertRow {
  return {
    user_id: userId,
    snapshot_date: snapshot.snapshotDate,
    total_value_aed: snapshot.totalValueAed,
    total_invested_aed: snapshot.totalInvestedAed,
    total_gain_loss_aed: snapshot.totalGainLossAed,
    holdings_count: snapshot.holdingsCount,
  };
}

function sortSnapshots(snapshots: PortfolioSnapshot[]) {
  return [...snapshots].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
}

function parseStoredSnapshots(raw: string | null): PortfolioSnapshot[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as PortfolioSnapshot[];
    return sortSnapshots(parsed);
  } catch {
    return [];
  }
}

export function upsertSnapshotInList(
  snapshots: PortfolioSnapshot[],
  snapshot: PortfolioSnapshot
): PortfolioSnapshot[] {
  const next = [...snapshots];
  const existingIndex = next.findIndex((item) => item.snapshotDate === snapshot.snapshotDate);

  if (existingIndex === -1) {
    next.push(snapshot);
  } else {
    next[existingIndex] = { ...next[existingIndex], ...snapshot };
  }

  return sortSnapshots(next);
}

export function loadLocalPortfolioSnapshots(userId: string) {
  return parseStoredSnapshots(localStorage.getItem(getSnapshotStorageKey(userId)));
}

export function persistLocalPortfolioSnapshots(userId: string, snapshots: PortfolioSnapshot[]) {
  localStorage.setItem(getSnapshotStorageKey(userId), JSON.stringify(sortSnapshots(snapshots)));
}

export async function fetchPortfolioSnapshots(userId: string): Promise<PortfolioSnapshot[]> {
  const localSnapshots = loadLocalPortfolioSnapshots(userId);
  const supabase = createClient();

  if (!hasDatabaseClient(supabase)) {
    return localSnapshots;
  }

  try {
    const { data, error } = await supabase
      .from("portfolio_snapshots")
      .select("*")
      .eq("user_id", userId)
      .order("snapshot_date", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const remoteSnapshots = (data || []).map(mapRowToSnapshot);
    if (remoteSnapshots.length > 0) {
      persistLocalPortfolioSnapshots(userId, remoteSnapshots);
      return remoteSnapshots;
    }
  } catch (error) {
    console.error("Failed to load portfolio snapshots:", error);
  }

  return localSnapshots;
}

export async function syncPortfolioSnapshot(userId: string, snapshot: PortfolioSnapshot) {
  const supabase = createClient();
  if (!hasDatabaseClient(supabase)) {
    return false;
  }

  const row = mapSnapshotToRow(userId, snapshot);
  const { error } = await supabase.from("portfolio_snapshots").upsert([row], {
    onConflict: "user_id,snapshot_date",
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function replacePortfolioSnapshots(userId: string, snapshots: PortfolioSnapshot[]) {
  const supabase = createClient();
  if (!hasDatabaseClient(supabase)) {
    persistLocalPortfolioSnapshots(userId, snapshots);
    return false;
  }

  const deleteResult = await supabase.from("portfolio_snapshots").delete().eq("user_id", userId);
  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }

  const sortedSnapshots = sortSnapshots(snapshots);
  persistLocalPortfolioSnapshots(userId, sortedSnapshots);

  if (!sortedSnapshots.length) {
    return true;
  }

  const rows = sortedSnapshots.map((snapshot) => mapSnapshotToRow(userId, snapshot));
  const { error } = await supabase.from("portfolio_snapshots").upsert(rows, {
    onConflict: "user_id,snapshot_date",
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
