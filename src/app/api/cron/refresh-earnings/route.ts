import { runScheduledEarningsRefresh } from "@/lib/earnings-scheduled-refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[cron/refresh-earnings] CRON_SECRET is not configured.");
    return Response.json(
      { success: false, error: "Scheduled refresh is not configured." },
      { status: 503 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledEarningsRefresh();
    if (result.failed.length) {
      console.warn(`[cron/refresh-earnings] ${result.failed.length} symbol(s) failed`, result.failed);
    }
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron/refresh-earnings] ${message}`);
    return Response.json(
      { success: false, error: "Scheduled earnings refresh failed." },
      { status: 500 }
    );
  }
}
