import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { filterProjects, isCatalogue, loadCatalogue, safeSource, type Catalogue } from './futureCatalogue';
const catalogue = JSON.parse(readFileSync(new URL('../../public/data/future-cbd.json', import.meta.url), 'utf8')) as Catalogue;
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('Future CBD catalogue', () => {
  it('validates the saved database export and filters buildings', () => {
    expect(isCatalogue(catalogue)).toBe(true);
    expect(catalogue.projects).toHaveLength(8);
    const buildings = filterProjects(catalogue.projects,'buildings','');
    expect(buildings.map(p => p.id)).toContain('gurrowa-place');
    expect(buildings).toHaveLength(3);
    expect(filterProjects(catalogue.projects,'transport','Franklin')).toHaveLength(1);
    expect(filterProjects(catalogue.projects,'','nonexistent')).toEqual([]);
  });
  it('rejects malformed content and unsafe source links', () => {
    expect(isCatalogue({ projects: [], topics: [] })).toBe(false);
    expect(safeSource('javascript:alert(1)')).toBe(false);
    expect(isCatalogue({ ...catalogue, projects: [{ ...catalogue.projects[0], stages: null }] })).toBe(false);
  });
  it('uses the API when available and falls back to saved data on failure', async () => {
    vi.stubEnv('VITE_FUTURE_API_URL','https://api.example.test');
    const fetcher = vi.fn().mockResolvedValueOnce({ok:true,json:async () => catalogue});
    vi.stubGlobal('fetch',fetcher);
    expect((await loadCatalogue(new AbortController().signal)).saved).toBe(false);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.example.test/api/catalogue');
    fetcher.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ok:true,json:async () => catalogue});
    expect((await loadCatalogue(new AbortController().signal)).saved).toBe(true);
    expect(fetcher.mock.calls[2][0]).toContain('data/future-cbd.json');
  });
  it('uses the same-origin hosted API by default', async () => {
    const fetcher = vi.fn().mockResolvedValue({ok:true,json:async () => catalogue});
    vi.stubGlobal('fetch',fetcher);
    expect((await loadCatalogue(new AbortController().signal)).saved).toBe(false);
    expect(fetcher.mock.calls[0][0]).toBe('/future-api/api/catalogue');
  });
  it('preserves completed sections within continuing projects', () => {
    const greenline = catalogue.projects.find(p => p.id === 'greenline')!;
    expect(greenline.status).toBe('approved');
    expect(greenline.stages.some(s => s.status === 'completed')).toBe(true);
    expect(greenline.stages.some(s => s.status === 'underway')).toBe(true);
  });
});
