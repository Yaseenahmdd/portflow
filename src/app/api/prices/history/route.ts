import {
  fetchHistoricalInrToAedRates,
  fetchHistoricalPriceHistories,
} from "@/lib/api/historical-prices";
import { isHolding } from "@/lib/holding-validation";
import {
  buildHistoricalPortfolioSnapshots,
  getHistoricalPortfolioStartDate,
} from "@/lib/historical-portfolio";
import { normalizeHoldings } from "@/lib/holdings-normalize";
import { createClient } from "@/lib/supabase/server";
import { isPortfolioTransaction, normalizeTransaction } from "@/lib/transactions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface HistoryRequestBody {
  holdings?: unknown;
  transactions?: unknown;
  fallbackInrToAedRate?: unknown;
}

function getDubaiTodayDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as HistoryRequestBody;
    if (!Array.isArray(body.holdings) || body.holdings.length > 100 || !body.holdings.every(isHolding)) {
      return Response.json({ success: false, error: "Invalid holdings data" }, { status: 400 });
    }
    if (
      body.transactions !== undefined &&
      (!Array.isArray(body.transactions) ||
        body.transactions.length > 10_000 ||
        !body.transactions.every(isPortfolioTransaction))
    ) {
      return Response.json({ success: false, error: "Invalid transactions data" }, { status: 400 });
    }

    const holdings = normalizeHoldings(body.holdings).normalized;
    const transactions = Array.isArray(body.transactions)
      ? body.transactions.filter(isPortfolioTransaction).map(normalizeTransaction)
      : [];
    const endDate = getDubaiTodayDateKey();
    const startDate = getHistoricalPortfolioStartDate(holdings, endDate, transactions);

    if (!startDate) {
      return Response.json(
        { success: false, error: "Add at least one purchase date before rebuilding history" },
        { status: 400 }
      );
    }

    const fetchStartDate = new Date(`${startDate}T00:00:00Z`);
    fetchStartDate.setUTCDate(fetchStartDate.getUTCDate() - 7);
    const marketDataStartDate = fetchStartDate.toISOString().slice(0, 10);
    const fallbackInrToAedRate = Number(body.fallbackInrToAedRate);

    const [priceResult, fxResult] = await Promise.all([
      fetchHistoricalPriceHistories(holdings, marketDataStartDate, endDate),
      fetchHistoricalInrToAedRates(marketDataStartDate, endDate)
        .then((rates) => ({ rates, failed: false }))
        .catch((error) => {
          console.warn("[prices/history] Historical INR/AED rates unavailable", error);
          return { rates: [], failed: true };
        }),
    ]);

    const snapshots = buildHistoricalPortfolioSnapshots(
      holdings,
      priceResult.histories,
      fxResult.rates,
      {
        startDate,
        endDate,
        fallbackInrToAedRate:
          Number.isFinite(fallbackInrToAedRate) && fallbackInrToAedRate > 0
            ? fallbackInrToAedRate
            : 0.044,
      },
      transactions
    );

    return Response.json({
      success: true,
      data: {
        snapshots,
        startDate,
        endDate,
        unavailableAssets: priceResult.failures.map((failure) => failure.assetName),
        usedFallbackFx: fxResult.failed,
        dividendsIncluded: false,
      },
    });
  } catch (error) {
    console.error("[prices/history] Failed to rebuild portfolio history", error);
    return Response.json(
      { success: false, error: "Failed to rebuild market history" },
      { status: 500 }
    );
  }
}
