import { fetchCryptoPrices } from '@/lib/api/coingecko';
import { CRYPTO_IDS } from '@/lib/constants';
import { requireAuthenticatedRouteUser } from '@/lib/supabase/route-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAuthenticatedRouteUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const ids = Object.values(CRYPTO_IDS);
    const results = await fetchCryptoPrices(ids);
    return Response.json({ success: true, data: results, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Crypto API error:', error);
    return Response.json({ success: false, error: 'Failed to fetch crypto prices' }, { status: 500 });
  }
}
