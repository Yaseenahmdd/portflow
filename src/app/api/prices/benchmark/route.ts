import { fetchSp500History } from "@/lib/api/historical-prices";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateKey(value: string | null): value is string {
  if (!value || !DATE_KEY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const startDate = params.get("start");
  const endDate = params.get("end");

  if (!isValidDateKey(startDate) || !isValidDateKey(endDate) || startDate > endDate) {
    return Response.json({ success: false, error: "Invalid benchmark date range" }, { status: 400 });
  }

  try {
    const points = await fetchSp500History(addDays(startDate, -7), endDate);
    if (points.length < 2) {
      throw new Error("Not enough S&P 500 history returned");
    }

    return Response.json({
      success: true,
      data: {
        symbol: "^GSPC",
        name: "S&P 500",
        points,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[prices/benchmark] S&P 500 history unavailable", error);
    return Response.json(
      { success: false, error: "S&P 500 data is temporarily unavailable" },
      { status: 503 }
    );
  }
}
