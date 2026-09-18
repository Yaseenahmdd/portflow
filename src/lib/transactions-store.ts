import { createClient } from "@/lib/supabase/client";
import {
  isPortfolioTransaction,
  normalizeTransaction,
  type PortfolioTransaction,
  type TransactionType,
} from "@/lib/transactions";
import type { Currency } from "@/lib/constants";

interface TransactionRow {
  user_id: string;
  id: string;
  transaction_type: TransactionType;
  transaction_date: string;
  holding_id: string | null;
  platform: string;
  asset_name: string;
  ticker: string;
  currency: Currency;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
  fees: number;
  fx_rate_to_aed: number | null;
  target_currency: Currency | null;
  target_amount: number | null;
  split_ratio: number | null;
  notes: string;
  created_at?: string | null;
  updated_at?: string | null;
}

type TransactionUpsertRow = Omit<TransactionRow, "created_at" | "updated_at">;
type DeleteBuilder = Promise<{ error: { message: string } | null }> & {
  eq: (column: string, value: string) => DeleteBuilder;
};
type SupabaseLikeClient = {
  from?: (table: string) => {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        order: (
          column: string,
          options?: { ascending?: boolean }
        ) => Promise<{ data: TransactionRow[] | null; error: { message: string } | null }>;
      };
    };
    upsert: (
      rows: TransactionUpsertRow[],
      options?: { onConflict?: string }
    ) => Promise<{ error: { message: string } | null }>;
    delete: () => DeleteBuilder;
  };
};

const STORAGE_PREFIX = "portflow-transactions-";

function hasDatabaseClient(client: unknown): client is Required<SupabaseLikeClient> {
  return typeof client === "object" && client !== null && typeof (client as SupabaseLikeClient).from === "function";
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function sortTransactions(transactions: PortfolioTransaction[]) {
  return [...transactions].sort((a, b) =>
    b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || "")
  );
}

export function loadLocalTransactions(userId: string): PortfolioTransaction[] {
  const raw = localStorage.getItem(storageKey(userId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown[];
    return sortTransactions(parsed.filter(isPortfolioTransaction).map(normalizeTransaction));
  } catch {
    return [];
  }
}

export function persistLocalTransactions(userId: string, transactions: PortfolioTransaction[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(sortTransactions(transactions)));
}

function mapRow(row: TransactionRow): PortfolioTransaction {
  return {
    id: row.id,
    type: row.transaction_type,
    date: row.transaction_date,
    holdingId: row.holding_id || undefined,
    platform: row.platform,
    assetName: row.asset_name,
    ticker: row.ticker,
    currency: row.currency,
    quantity: row.quantity ?? undefined,
    price: row.unit_price ?? undefined,
    amount: row.amount ?? undefined,
    fees: row.fees || undefined,
    fxRateToAed: row.fx_rate_to_aed ?? undefined,
    targetCurrency: row.target_currency || undefined,
    targetAmount: row.target_amount ?? undefined,
    splitRatio: row.split_ratio ?? undefined,
    notes: row.notes,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

function mapToRow(userId: string, transaction: PortfolioTransaction): TransactionUpsertRow {
  const normalized = normalizeTransaction(transaction);
  return {
    user_id: userId,
    id: normalized.id,
    transaction_type: normalized.type,
    transaction_date: normalized.date,
    holding_id: normalized.holdingId || null,
    platform: normalized.platform,
    asset_name: normalized.assetName,
    ticker: normalized.ticker,
    currency: normalized.currency,
    quantity: normalized.quantity ?? null,
    unit_price: normalized.price ?? null,
    amount: normalized.amount ?? null,
    fees: normalized.fees || 0,
    fx_rate_to_aed: normalized.fxRateToAed ?? null,
    target_currency: normalized.targetCurrency || null,
    target_amount: normalized.targetAmount ?? null,
    split_ratio: normalized.splitRatio ?? null,
    notes: normalized.notes,
  };
}

export async function fetchRemoteTransactions(userId: string) {
  const supabase = createClient();
  if (!hasDatabaseClient(supabase)) return null;

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("transaction_date", { ascending: false });

  if (error) throw new Error(error.message);
  return sortTransactions((data || []).map(mapRow));
}

export async function upsertRemoteTransactions(userId: string, transactions: PortfolioTransaction[]) {
  const supabase = createClient();
  if (!hasDatabaseClient(supabase) || !transactions.length) return false;

  const { error } = await supabase.from("transactions").upsert(
    transactions.map((transaction) => mapToRow(userId, transaction)),
    { onConflict: "user_id,id" }
  );
  if (error) throw new Error(error.message);
  return true;
}

export async function deleteRemoteTransaction(userId: string, transactionId: string) {
  const supabase = createClient();
  if (!hasDatabaseClient(supabase)) return false;

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .eq("id", transactionId);
  if (error) throw new Error(error.message);
  return true;
}
