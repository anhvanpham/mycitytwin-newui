import { normalizeRoadFeatures, object, REFRESH_SECONDS, ROAD_SOURCES, type RoadDoc, type RoadFeed, type RoadFeedKind } from '../src/data/roadDisruptions';

export interface RoadEnv { TRANSPORT_VIC_API_KEY?: string }
const ENDPOINTS = {
  planned: 'https://api.opendata.transport.vic.gov.au/opendata/roads/disruptions/planned/v1/?format=GeoJson',
  unplanned: 'https://api.opendata.transport.vic.gov.au/api/opendata/roads/disruptions/unplanned/v3',
};
const MAX_PAGES = 8;
function empty(kind: RoadFeedKind, status: RoadFeed['status']): RoadFeed {
  return { kind, status, checkedAt: null, refreshSeconds: REFRESH_SECONDS[kind], sourceUrl: ROAD_SOURCES[kind], notices: [], unlocatedCount: 0 };
}
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
});
/** Fetch only the fixed official hosts. Never follow API-supplied pagination URLs with a secret. */
async function collect(kind: RoadFeedKind, key: string, upstream: typeof fetch): Promise<RoadFeed> {
  const features: unknown[] = [];
  const signal = AbortSignal.timeout(15000);
  let nextToken = ''; const seenTokens = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(ENDPOINTS[kind]);
    const headers: Record<string, string> = { Accept: 'application/json', KeyId: key };
    if (kind === 'planned') {
      // The portal and its downloadable planned OpenAPI specify different header names.
      // Both remain server-side; live authentication must be verified after key setup.
      headers['Ocp-Apim-Subscription-Key'] = key;
      if (nextToken) headers.NextPageToken = nextToken;
    } else {
      url.searchParams.set('page', String(page)); url.searchParams.set('limit', '1000');
    }
    const response = await upstream(url, { headers, signal, redirect: 'error' });
    if (!response.ok) throw new Error('Official feed unavailable');
    const body = object(await response.json());
    const collection = kind === 'planned' ? body : object(body.data);
    if (!Array.isArray(collection.features)) throw new Error('Unexpected feed format');
    features.push(...collection.features);
    if (kind === 'planned') {
      const paging = object(body.nextPageDetails);
      if (paging.hasMoreRecords !== true) {
        if (paging.hasMoreRecords != null && paging.hasMoreRecords !== false) throw new Error('Invalid pagination');
        if (typeof paging.nextPageToken === 'string' && paging.nextPageToken.trim()) throw new Error('Ambiguous pagination');
        return { ...empty(kind, 'ready'), checkedAt: new Date().toISOString(), ...normalizeRoadFeatures(features, kind) };
      }
      nextToken = typeof paging.nextPageToken === 'string' ? paging.nextPageToken.trim() : '';
      if (!nextToken || seenTokens.has(nextToken)) throw new Error('Incomplete feed pagination');
      seenTokens.add(nextToken);
    } else {
      const meta = object(body.meta);
      if (!Number.isInteger(meta.total_pages) || Number(meta.total_pages) < 0 || !Number.isInteger(meta.page) || Number(meta.page) !== page) throw new Error('Incomplete feed pagination');
      if (page >= Number(meta.total_pages)) return { ...empty(kind, 'ready'), checkedAt: new Date().toISOString(), ...normalizeRoadFeatures(features, kind) };
    }
  }
  // Do not turn a truncated state-wide result into a misleading zero near a sensor.
  throw new Error('Feed exceeds pagination budget');
}

export function createRoadHandler(upstream: typeof fetch = fetch) {
  const memory = new Map<RoadFeedKind, { feed: RoadFeed; expires: number }>();
  const inflight = new Map<RoadFeedKind, Promise<RoadFeed>>();
  async function feed(kind: RoadFeedKind, key: string, origin: string, cache?: Cache): Promise<RoadFeed> {
    const existing = memory.get(kind);
    if (existing && existing.expires > Date.now()) return existing.feed;
    const pending = inflight.get(kind); if (pending) return pending;
    const work = (async () => {
      const cacheKey = new Request(`${origin}/road-disruptions-cache/${kind}-v1`);
      try {
        const cached = await cache?.match(cacheKey);
        if (cached) {
          const result = await cached.json() as RoadFeed;
          if (result.kind === kind && result.status === 'ready' && result.checkedAt && Date.now() - Date.parse(result.checkedAt) < REFRESH_SECONDS[kind] * 1000) {
            memory.set(kind, { feed: result, expires: Date.parse(result.checkedAt) + REFRESH_SECONDS[kind] * 1000 }); return result;
          }
        }
      } catch { /* An optional cache failure must not prevent fetching the official feed. */ }
      let result: RoadFeed;
      try { result = await collect(kind, key, upstream); } catch { result = empty(kind, 'unavailable'); }
      const seconds = result.status === 'ready' ? REFRESH_SECONDS[kind] : 60;
      memory.set(kind, { feed: result, expires: Date.now() + seconds * 1000 });
      if (result.status === 'ready' && cache) {
        try { await cache.put(cacheKey, json(result, 200, { 'Cache-Control': `public, max-age=${seconds}` })); } catch { /* In-memory caching remains available. */ }
      }
      return result;
    })();
    inflight.set(kind, work);
    try { return await work; } finally { inflight.delete(kind); }
  }
  return async (request: Request, env: RoadEnv, cache?: Cache): Promise<Response> => {
    const url = new URL(request.url);
    if (!['/road-disruptions-api', '/road-disruptions-api/'].includes(url.pathname)) return json({ error: 'Not found' }, 404);
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'Read-only endpoint' }, 405, { Allow: 'GET, HEAD' });
    const key = env.TRANSPORT_VIC_API_KEY?.trim();
    const feeds = await Promise.all((['planned', 'unplanned'] as const).map(kind => key ? feed(kind, key, url.origin, cache) : empty(kind, 'unconfigured')));
    const doc: RoadDoc = { schemaVersion: 1, feeds };
    const response = json(doc);
    return request.method === 'HEAD' ? new Response(null, { headers: response.headers }) : response;
  };
}
export const fetchRoadDisruptions = createRoadHandler();
