import { fetchDfmQuotes } from '@/lib/api/dfm';
import { UAE_STOCK_TICKERS } from '@/lib/constants';
import { requireAuthenticatedRouteUser } from '@/lib/supabase/route-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAuthenticatedRouteUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const results = await fetchDfmQuotes(UAE_STOCK_TICKERS);
    return Response.json({
      success: true,
      data: results.data,
      source: results.source,
      stale: results.stale,
      timestamp: results.lastUpdated,
    });
  } catch (error) {
    console.error('UAE Stocks API error:', error);
    return Response.json({ success: false, error: 'Failed to fetch UAE stock prices' }, { status: 500 });
  }
}
