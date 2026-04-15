import { fetchExchangeRates } from '@/lib/api/frankfurter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const results = await fetchExchangeRates();
    return Response.json({ success: true, data: results, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Currency API error:', error);
    return Response.json({ success: false, error: 'Failed to fetch exchange rates' }, { status: 500 });
  }
}
