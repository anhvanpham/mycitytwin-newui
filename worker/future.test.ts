/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fetchFuture, type Database, type Statement } from './future';
import { isCatalogue } from '../src/data/futureCatalogue';

let sqlite: DatabaseSync;
let database: Database;
function statement(sql: string, values: (string | number | null)[] = []): Statement {
  return {
    bind: (...parameters) => statement(sql, parameters),
    all: async () => ({ results: sqlite.prepare(sql).all(...values) }),
  };
}
const assets = { fetch: async () => new Response('{"version":1,"density":{"type":"FeatureCollection"}}', {
  headers: { 'Content-Type': 'application/json' },
}) };
const get = (path: string, method = 'GET') => fetchFuture(new Request('https://example.test/future-api' + path, { method }), { FUTURE_DB: database, ASSETS: assets });
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  sqlite.exec(readFileSync(new URL('./future-database.sql', import.meta.url), 'utf8'));
  database = { prepare: sql => statement(sql), batch: async statements => Promise.all(statements.map(s => s.all())) };
});
afterEach(() => sqlite.close());

describe('hosted Future Plans API with the exported SQLite data', () => {
  it('serves complete projects, written answers, stages and maps in the frontend format', async () => {
    const response = await get('/api/catalogue');
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(isCatalogue(data)).toBe(true);
    expect(data.projects).toHaveLength(8);
    expect(data.topics).toHaveLength(6);
    expect(data.maps).toHaveLength(7);
    expect(data.projects.flatMap((p: { answers: unknown[] }) => p.answers)).toHaveLength(48);
    expect(data.projects.flatMap((p: { stages: unknown[] }) => p.stages)).toHaveLength(12);
    const airport = await (await get('/api/projects/melbourne-airport-rail')).json();
    expect(airport.stages).toHaveLength(2);
    expect(airport.answers.every((a: { body: string }) => a.body.length >= 80)).toBe(true);
  });
  it('reflects database updates on the next request and excludes draft news in every response', async () => {
    sqlite.prepare('UPDATE projects SET summary=? WHERE id=?').run('A reviewed database update.', 'greenline');
    expect((await (await get('/api/projects/greenline')).json()).summary).toBe('A reviewed database update.');
    sqlite.exec("UPDATE news SET review_status='draft' WHERE id='forest-approved-news'");
    const catalogue = await (await get('/api/catalogue')).json();
    expect(catalogue.news).toHaveLength(1);
    expect(catalogue.projects.flatMap((p: { news: { id: string }[] }) => p.news).map((n: { id: string }) => n.id)).not.toContain('forest-approved-news');
    expect(await (await get('/api/news?topic=urban-greening')).json()).toEqual([]);
  });
  it('applies topic, status, project and query filters with bound parameters', async () => {
    expect(await (await get('/api/projects?topic=buildings')).json()).toHaveLength(3);
    expect(await (await get('/api/projects?topic=transport&q=Franklin')).json()).toHaveLength(1);
    expect(await (await get('/api/projects?status=unknown')).json()).toHaveLength(1);
    expect(await (await get('/api/news?project=melbourne-airport-rail')).json()).toHaveLength(1);
    expect(await (await get('/api/projects?q=' + encodeURIComponent("' OR 1=1 --"))).json()).toEqual([]);
    expect(await (await get('/api/news?project=' + encodeURIComponent("' OR 1=1 --"))).json()).toEqual([]);
  });
  it('checks the database in health, rejects writes and handles unknown resources', async () => {
    expect(await (await get('/api/health')).json()).toEqual({ status: 'ok', database: 'cloudflare-d1', projects: 8, answers: 48 });
    expect((await get('/api/projects/absent')).status).toBe(404);
    expect((await get('/api/absent')).status).toBe(404);
    expect((await get('/api/catalogue', 'POST')).status).toBe(405);
    expect((await get('/api/catalogue', 'HEAD')).body).toBeNull();
    expect(sqlite.prepare('SELECT count(*) AS n FROM projects').get()?.n).toBe(8);
    const unconfigured = await fetchFuture(new Request('https://example.test/future-api/api/health'), { ASSETS: assets });
    expect(unconfigured.status).toBe(503);
    expect(await unconfigured.json()).toEqual({ error: 'Project database unavailable' });
  });
  it('serves the fixed spatial baseline through assets separately from live project schedules', async () => {
    const response = await get('/api/spatial-context');
    expect(response.status).toBe(200);
    expect((await response.json()).density.type).toBe('FeatureCollection');
    expect((await get('/api/spatial-context', 'HEAD')).body).toBeNull();
  });
});
