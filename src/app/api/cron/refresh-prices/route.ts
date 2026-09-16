import { runScheduledPriceRefresh } from "@/lib/prices/scheduled-refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[cron/refresh-prices] CRON_SECRET is not configured.");
    return Response.json(
      { success: false, error: "Scheduled refresh is not configured." },
      { status: 503 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    return Response.json(await runScheduledPriceRefresh());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron/refresh-prices] ${message}`);
    return Response.json(
      { success: false, error: "Scheduled price refresh failed." },
      { status: 500 }
    );
  }
}
