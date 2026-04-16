import { fetchAlphaVantageMultiple } from '@/lib/api/alphavantage';
import { INDIAN_STOCK_TICKERS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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
