import { fetchAlphaVantageMultiple } from '@/lib/api/alphavantage';
import { INDIAN_STOCK_TICKERS } from '@/lib/constants';
import { requireAuthenticatedRouteUser } from '@/lib/supabase/route-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAuthenticatedRouteUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const symbols = Object.values(INDIAN_STOCK_TICKERS);
    const results = await fetchAlphaVantageMultiple(symbols);
    return Response.json({ success: true, data: results, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Indian Stocks API error:', error);
    return Response.json({ success: false, error: 'Failed to fetch Indian stock prices' }, { status: 500 });
  }
}
