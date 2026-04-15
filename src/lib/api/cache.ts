export interface CachedFetchResult<T> {
  data: T;
  lastUpdated: string;
  stale: boolean;
  source: string;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  lastUpdated: string;
  source: string;
}

declare global {
  var __portflowMarketCache: Map<string, CacheEntry<unknown>> | undefined;
}

const marketCache = globalThis.__portflowMarketCache ?? new Map<string, CacheEntry<unknown>>();

if (!globalThis.__portflowMarketCache) {
  globalThis.__portflowMarketCache = marketCache;
}

export async function getCachedOrFetch<T>({
  key,
  ttlMs,
  source,
  loader,
  forceRefresh = false,
}: {
  key: string;
  ttlMs: number;
  source: string;
  loader: () => Promise<T>;
  forceRefresh?: boolean;
}): Promise<CachedFetchResult<T>> {
  const now = Date.now();
  const cached = marketCache.get(key) as CacheEntry<T> | undefined;

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return {
      data: cached.data,
      lastUpdated: cached.lastUpdated,
      stale: false,
      source: cached.source,
    };
  }

  try {
    const data = await loader();
    const lastUpdated = new Date().toISOString();

    marketCache.set(key, {
      data,
      expiresAt: now + ttlMs,
      lastUpdated,
      source,
    });

    return {
      data,
      lastUpdated,
      stale: false,
      source,
    };
  } catch (error) {
    if (cached) {
      return {
        data: cached.data,
        lastUpdated: cached.lastUpdated,
        stale: true,
        source: cached.source,
      };
    }

    throw error;
  }
}
