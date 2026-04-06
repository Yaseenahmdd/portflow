export const dynamic = 'force-dynamic';

interface PriceResult {
  source: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export async function GET(request: Request) {
  const baseUrl = new URL(request.url).origin;

  const endpoints = [
    { source: 'indian-mf', path: '/api/prices/indian-mf' },
    { source: 'indian-stocks', path: '/api/prices/indian-stocks' },
    { source: 'us-etfs', path: '/api/prices/us-etfs' },
    { source: 'uae-stocks', path: '/api/prices/uae-stocks' },
    { source: 'crypto', path: '/api/prices/crypto' },
    { source: 'currency', path: '/api/prices/currency' },
  ];

  const results: PriceResult[] = await Promise.all(
    endpoints.map(async ({ source, path }) => {
      try {
        const res = await fetch(`${baseUrl}${path}`, {
          headers: {
            cookie: request.headers.get('cookie') || '',
          },
        });
        const data = await res.json();
        return { source, success: data.success, data: data.data };
      } catch (error) {
        return { source, success: false, error: String(error) };
      }
    })
  );

  return Response.json({
    success: true,
    results,
    timestamp: new Date().toISOString(),
  });
}
