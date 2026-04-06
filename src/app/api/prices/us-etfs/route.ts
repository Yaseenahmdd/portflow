import { fetchTwelveDataQuotes } from '@/lib/api/twelvedata';
import { US_ETF_TICKERS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const results = await fetchTwelveDataQuotes(US_ETF_TICKERS);
    return Response.json({ success: true, data: results, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('US ETFs API error:', error);
    return Response.json({ success: false, error: 'Failed to fetch US ETF prices' }, { status: 500 });
  }
}
