import { fetchAlphaVantageMultiple } from '@/lib/api/alphavantage';
import { US_ETF_TICKERS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const results = await fetchAlphaVantageMultiple(US_ETF_TICKERS);
    return Response.json({ success: true, data: results, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('US ETFs API error:', error);
    return Response.json({ success: false, error: 'Failed to fetch US ETF prices' }, { status: 500 });
  }
}
