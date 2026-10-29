/**
 * Yahoo Finance headline RSS feed. No API key required.
 */

export interface Headline {
  title: string;
  url: string;
  publishedAt: string | null; // ISO timestamp
}

const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_SECONDS = 60 * 60;

function decodeXml(value: string) {
  return value
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .trim();
}

function readTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? decodeXml(match[1]) : "";
}

export function parseHeadlinesRss(xml: string, limit = 6): Headline[] {
  const headlines: Headline[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = readTag(item, "title");
    const url = readTag(item, "link");
    if (!title || !/^https:\/\//.test(url)) continue;
    const published = Date.parse(readTag(item, "pubDate"));
    headlines.push({ title, url, publishedAt: Number.isFinite(published) ? new Date(published).toISOString() : null });
    if (headlines.length >= limit) break;
  }
  return headlines;
}

export async function fetchHeadlines(symbol: string): Promise<Headline[]> {
  try {
    const res = await fetch(
      `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`,
      {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        next: { revalidate: CACHE_SECONDS },
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      }
    );
    if (!res.ok) throw new Error(`Yahoo RSS error: ${res.status}`);
    // Keep a longer list than the panel shows so guidance headlines around a report are caught.
    return parseHeadlinesRss(await res.text(), 25);
  } catch (error) {
    console.error(`Yahoo RSS: failed to fetch ${symbol}:`, error);
    return [];
  }
}
