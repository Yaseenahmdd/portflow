import { getEarningsSymbol } from "@/lib/earnings";
import {
  collectEarnings,
  mapWithConcurrency,
  readStoredEarnings,
  recordEarningsFailure,
  saveEarnings,
} from "@/lib/earnings-store";
import { mapRowToHolding, type HoldingRow } from "@/lib/holdings-store";
import { normalizeHoldings } from "@/lib/holdings-normalize";
import { createAdminClient } from "@/lib/supabase/admin";

const CONCURRENCY = 4;
// Leave headroom under the route's 60s limit; skipped symbols are fetched
// live on the next page view and retried tomorrow night.
const TIME_BUDGET_MS = 45_000;

/** Earnings symbols across every user's open stock positions. */
export function getScheduledEarningsSymbols(rows: HoldingRow[]) {
  const holdings = normalizeHoldings(rows.map(mapRowToHolding)).normalized;
  const symbols = new Set<string>();
  for (const holding of holdings) {
    if (holding.quantity <= 0) continue;
    const symbol = getEarningsSymbol(holding);
    if (symbol) symbols.add(symbol);
  }
  return [...symbols].sort();
}

export async function runScheduledEarningsRefresh() {
  const startedAt = Date.now();
  const admin = createAdminClient();
  const { data, error } = await admin.from("holdings").select("*");
  if (error) throw new Error(error.message);

  const symbols = getScheduledEarningsSymbols((data || []) as HoldingRow[]);
  const today = new Date().toISOString().slice(0, 10);
  const stored = await readStoredEarnings(admin, symbols);

  const outcomes = await mapWithConcurrency(symbols, CONCURRENCY, async (symbol) => {
    if (Date.now() - startedAt > TIME_BUDGET_MS) return { symbol, status: "skipped" as const };
    const now = new Date();
    try {
      const collected = await collectEarnings(symbol, today, stored.get(symbol)?.summary.history);
      if (!collected) throw new Error("No earnings data returned");
      await saveEarnings(admin, collected, now);
      return { symbol, status: "updated" as const };
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
      await recordEarningsFailure(admin, symbol, message, now).catch(() => undefined);
      return { symbol, status: "failed" as const, error: message };
    }
  });

  return {
    success: true,
    symbolsScanned: symbols.length,
    updated: outcomes.filter((outcome) => outcome.status === "updated").map((outcome) => outcome.symbol),
    failed: outcomes.filter((outcome) => outcome.status === "failed"),
    skipped: outcomes.filter((outcome) => outcome.status === "skipped").map((outcome) => outcome.symbol),
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  };
}
