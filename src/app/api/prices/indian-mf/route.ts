import { fetchMutualFundNav } from '@/lib/api/mfapi';
import { MF_SCHEMES } from '@/lib/constants';
import { requireAuthenticatedRouteUser } from '@/lib/supabase/route-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAuthenticatedRouteUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const schemeCodes = Object.values(MF_SCHEMES).map((s) => s.schemeCode);
    const results = await fetchMutualFundNav(schemeCodes);
    return Response.json({ success: true, data: results, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Indian MF API error:', error);
    return Response.json({ success: false, error: 'Failed to fetch MF NAV' }, { status: 500 });
  }
}
