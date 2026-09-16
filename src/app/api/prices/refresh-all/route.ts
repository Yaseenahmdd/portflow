import type { Holding } from "@/lib/constants";
import { fetchAllPriceResults } from "@/lib/prices/refresh-all";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const holdings = (body?.holdings || []) as Holding[];

    const results = await fetchAllPriceResults(holdings);

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
