import { applyRefreshResults } from "@/lib/dashboard/refresh";
import { mapRowToHolding, type HoldingRow } from "@/lib/holdings-store";
import { normalizeHoldings } from "@/lib/holdings-normalize";
import { fetchAllPriceResults } from "@/lib/prices/refresh-all";
import { buildScheduledPriceUpdates } from "@/lib/prices/scheduled-updates";
import { createAdminClient } from "@/lib/supabase/admin";

const UPDATE_BATCH_SIZE = 10;

async function updateHoldingPrices(
  admin: ReturnType<typeof createAdminClient>,
  updates: ReturnType<typeof buildScheduledPriceUpdates>
) {
  for (let offset = 0; offset < updates.length; offset += UPDATE_BATCH_SIZE) {
    const batch = updates.slice(offset, offset + UPDATE_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (update) => {
        const { error } = await admin
          .from("holdings")
          .update({
            current_price: update.currentPrice,
            previous_close: update.previousClose,
            day_change_percent: update.dayChangePercent,
            last_price_update: update.lastPriceUpdate,
            price_as_of: update.priceAsOf,
            price_session: update.priceSession,
          })
          .eq("user_id", update.userId)
          .eq("id", update.id);

        return error;
      })
    );

    const failedUpdate = results.find(Boolean);
    if (failedUpdate) {
      throw new Error(failedUpdate.message);
    }
  }
}

export async function runScheduledPriceRefresh() {
  const startedAt = Date.now();
  const admin = createAdminClient();
  const { data, error } = await admin.from("holdings").select("*");

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data || []) as HoldingRow[];
  const originalHoldings = normalizeHoldings(rows.map(mapRowToHolding)).normalized;
  const results = await fetchAllPriceResults(originalHoldings);
  const refreshed = applyRefreshResults(originalHoldings, results);
  const updates = buildScheduledPriceUpdates(
    originalHoldings,
    refreshed.holdings,
    rows.map((row) => ({ userId: row.user_id, id: row.id }))
  );

  await updateHoldingPrices(admin, updates);

  if (refreshed.inrToAedRate && refreshed.fxUpdatedAt) {
    const { error: rateError } = await admin.from("market_rates").upsert(
      {
        pair: "INR_AED",
        rate: refreshed.inrToAedRate,
        fetched_at: refreshed.fxUpdatedAt,
      },
      { onConflict: "pair" }
    );

    if (rateError) {
      throw new Error(rateError.message);
    }
  }

  return {
    success: true,
    holdingsScanned: originalHoldings.length,
    holdingsUpdated: updates.length,
    failures: results
      .filter((result) => !result.success)
      .map((result) => ({ source: result.source, error: result.error })),
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  };
}
