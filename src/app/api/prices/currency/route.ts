import { fetchExchangeRates } from '@/lib/api/frankfurter';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const results = await fetchExchangeRates();
    return Response.json({ success: true, data: results, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Currency API error:', error);
    return Response.json({ success: false, error: 'Failed to fetch exchange rates' }, { status: 500 });
  }
}
