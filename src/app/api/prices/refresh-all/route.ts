import type { Holding } from "@/lib/constants";
import { isHolding } from "@/lib/holding-validation";
import { fetchAllPriceResults, type PriceRefreshScope } from "@/lib/prices/refresh-all";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { holdings?: unknown; scope?: unknown };
    if (
      !Array.isArray(body.holdings) ||
      body.holdings.length > 100 ||
      !body.holdings.every(isHolding)
    ) {
      return Response.json(
        { success: false, error: "Invalid holdings data" },
        { status: 400 }
      );
    }

    const holdings: Holding[] = body.holdings;
    const scope: PriceRefreshScope = body.scope === "live" ? "live" : "all";

    const results = await fetchAllPriceResults(holdings, scope);

    return Response.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[prices/refresh-all]", error);
    return Response.json(
      { success: false, error: "Failed to refresh prices" },
      { status: 500 }
    );
  }
}
