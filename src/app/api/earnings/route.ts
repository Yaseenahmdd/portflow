import type { EarningsSummary } from '@/lib/api/nasdaq-earnings';
import { loadEarnings } from '@/lib/earnings-store';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_SYMBOLS = 40;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const symbols = [
    ...new Set(
      (new URL(request.url).searchParams.get('symbols') ?? '')
        .split(',')
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => /^[A-Z][A-Z.-]{0,9}$/.test(symbol))
    ),
  ].slice(0, MAX_SYMBOLS);

  if (!symbols.length) {
    return Response.json({ success: true, data: {}, timestamp: new Date().toISOString() });
  }

  try {
    const earnings = await loadEarnings(supabase, symbols);
    const data: Record<string, EarningsSummary> = {};
    const meta: Record<string, { fetchedAt: string; lastError: string | null }> = {};
    for (const [symbol, entry] of earnings) {
      data[symbol] = entry.summary;
      meta[symbol] = { fetchedAt: entry.fetchedAt, lastError: entry.lastError };
    }
    return Response.json({ success: true, data, meta, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Earnings API error:', error);
    return Response.json({ success: false, error: 'Failed to fetch earnings' }, { status: 500 });
  }
}
