import { fetchDfmQuotes } from '@/lib/api/dfm';
import { UAE_STOCK_TICKERS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const results = await fetchDfmQuotes(UAE_STOCK_TICKERS);
    if (!Object.keys(results).length) {
      throw new Error('DFM returned no quotes');
    }
    return Response.json({ success: true, data: results, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('UAE Stocks API error:', error);
    return Response.json({ success: false, error: 'Failed to fetch UAE stock prices' }, { status: 500 });
  }
}
