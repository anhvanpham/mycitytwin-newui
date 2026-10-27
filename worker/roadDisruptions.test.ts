import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import worker from './index';
import { createRoadHandler } from './roadDisruptions';

const request = (method = 'GET', path = '/road-disruptions-api') => new Request(`https://example.test${path}`, { method });
const plannedResponse = (token?: string) => Response.json({ type: 'FeatureCollection', features: [], nextPageDetails: { hasMoreRecords: !!token, nextPageToken: token ?? '' } });
const unplannedResponse = (page = 1, total = 1) => Response.json({ data: { type: 'FeatureCollection', features: [] }, meta: { page, total_pages: total } });

describe('road feed server integration', () => {
  it('requires no key to render a truthful not-connected state and does not fetch upstream', async () => {
    const upstream = vi.fn(); const handler = createRoadHandler(upstream);
    const result = await handler(request(), {}); const body = await result.json();
    expect(body.feeds.map((f: { status: string }) => f.status)).toEqual(['unconfigured', 'unconfigured']);
    expect(upstream).not.toHaveBeenCalled();
    expect(result.headers.get('cache-control')).toBe('no-store');
  });
  it('is read-only and handles only its intended path', async () => {
    const handler = createRoadHandler(vi.fn());
    expect((await handler(request('POST'), {})).status).toBe(405);
    expect((await handler(request('GET', '/road-disruptions-api/elsewhere'), {})).status).toBe(404);
    expect(await (await handler(request('HEAD'), {})).text()).toBe('');
  });
  it('uses official endpoints, headers and both pagination formats without exposing a secret', async () => {
    const upstream = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = new URL(String(input)); const headers = new Headers(options?.headers);
      expect(url.hostname).toBe('api.opendata.transport.vic.gov.au');
      expect(url.href).not.toContain('test-secret');
      expect(headers.get('KeyId')).toBe('test-secret');
      expect(options?.redirect).toBe('error');
      if (url.pathname.includes('/planned/')) {
        expect(headers.get('Ocp-Apim-Subscription-Key')).toBe('test-secret');
        return plannedResponse(headers.get('NextPageToken') ? undefined : 'second');
      }
      expect(url.pathname).toBe('/api/opendata/roads/disruptions/unplanned/v3');
      return unplannedResponse(Number(url.searchParams.get('page')), 2);
    });
    const handler = createRoadHandler(upstream);
    const response = await handler(request(), { TRANSPORT_VIC_API_KEY: 'test-secret' });
    const text = await response.text(); expect(text).not.toContain('test-secret');
    expect(JSON.parse(text).feeds.every((f: { status: string }) => f.status === 'ready')).toBe(true);
    expect(upstream).toHaveBeenCalledTimes(4);
    await handler(request(), { TRANSPORT_VIC_API_KEY: 'test-secret' });
    expect(upstream).toHaveBeenCalledTimes(4);
  });
  it('keeps a working feed available when the other fails and never returns upstream error text', async () => {
    const upstream = vi.fn(async (input: RequestInfo | URL) => String(input).includes('/planned/') ? plannedResponse() : new Response('private test-secret', { status: 401 }));
    const handler = createRoadHandler(upstream); const response = await handler(request(), { TRANSPORT_VIC_API_KEY: 'test-secret' });
    const text = await response.text(), body = JSON.parse(text);
    expect(body.feeds.map((f: { status: string }) => f.status)).toEqual(['ready', 'unavailable']);
    expect(text).not.toContain('test-secret');
    await handler(request(), { TRANSPORT_VIC_API_KEY: 'test-secret' }); expect(upstream).toHaveBeenCalledTimes(2);
  });
  it('rejects incomplete pagination instead of silently claiming a complete empty feed', async () => {
    const upstream = vi.fn(async (input: RequestInfo | URL) => String(input).includes('/planned/') ? plannedResponse('same-token') : Response.json({ data: { features: [] } }));
    const body = await (await createRoadHandler(upstream)(request(), { TRANSPORT_VIC_API_KEY: 'key' })).json();
    expect(body.feeds.every((f: { status: string }) => f.status === 'unavailable')).toBe(true);
    expect(upstream).toHaveBeenCalledTimes(3);
  });
  it('coalesces concurrent viewers and expires incident data sooner than planned works', async () => {
    vi.useFakeTimers();
    try {
      const upstream = vi.fn(async (input: RequestInfo | URL) => String(input).includes('/planned/') ? plannedResponse() : unplannedResponse());
      const handler = createRoadHandler(upstream); const env = { TRANSPORT_VIC_API_KEY: 'key' };
      await Promise.all([handler(request(), env), handler(request(), env)]);
      expect(upstream).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(61000); await handler(request(), env);
      expect(upstream).toHaveBeenCalledTimes(3);
      vi.advanceTimersByTime(1800000); await handler(request(), env);
      expect(upstream).toHaveBeenCalledTimes(5);
    } finally { vi.useRealTimers(); }
  });
});


it('routes the live API through the Worker instead of the versioned asset fallback', async () => {
  const assets = vi.fn();
  const response = await worker.fetch(request(), { ASSETS: { fetch: assets } });
  expect((await response.json()).feeds[0].status).toBe('unconfigured');
  expect(assets).not.toHaveBeenCalled();
  const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  expect(config.assets.run_worker_first).toContain('/road-disruptions-api');
  expect(config.assets.run_worker_first).toContain('/road-disruptions-api/*');
});
