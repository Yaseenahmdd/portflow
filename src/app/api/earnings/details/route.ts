import { loadEarnings } from '@/lib/earnings-store';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const symbol = (new URL(request.url).searchParams.get('symbol') ?? '').trim().toUpperCase();
  if (!/^[A-Z][A-Z.-]{0,9}$/.test(symbol)) {
    return Response.json({ success: false, error: 'Invalid symbol' }, { status: 400 });
  }

  try {
    const entry = (await loadEarnings(supabase, [symbol])).get(symbol);
    if (!entry) {
      return Response.json({ success: false, error: 'No earnings data for this symbol' }, { status: 404 });
    }
    return Response.json({
      success: true,
      data: { details: entry.details, headlines: entry.headlines, price: entry.price, fetchedAt: entry.fetchedAt },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Earnings details API error:', error);
    return Response.json({ success: false, error: 'Failed to fetch earnings details' }, { status: 500 });
  }
}
