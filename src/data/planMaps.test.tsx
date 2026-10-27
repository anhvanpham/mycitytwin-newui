import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { PlanMaps, mapImageUrl } from '../ui/PlanMaps';
import { isPlanMap, type Catalogue } from './futureCatalogue';
const catalogue = JSON.parse(readFileSync(new URL('../../public/data/future-cbd.json', import.meta.url), 'utf8')) as Catalogue;
afterEach(() => vi.unstubAllEnvs());
describe('standalone official plan maps', () => {
 it('renders verified maps with captions and sources', () => {
  expect(catalogue.maps).toHaveLength(7);
  for (const map of catalogue.maps!) {
   expect(isPlanMap(map)).toBe(true);
   const html = renderToStaticMarkup(<PlanMaps maps={[map]} />);
   expect(html).toContain('<img');
   expect(html).toContain('Map source:');
   expect(html).toContain('Open map full size');
  }
 });
 it('resolves local assets inside a versioned release', () => {
  vi.stubEnv('BASE_URL','/ver-4/');
  expect(mapImageUrl('data/plan-maps/map.png')).toBe('/ver-4/data/plan-maps/map.png');
  expect(mapImageUrl('https://example.com/map.png')).toBe('https://example.com/map.png');
 });
 it('rejects unsafe images and path traversal', () => {
  const map = catalogue.maps![0];
  expect(isPlanMap({...map,image_url:'javascript:alert(1)'})).toBe(false);
  expect(isPlanMap({...map,image_url:'data/plan-maps/../../secret.png'})).toBe(false);
 });
 it('does not invent a map for a plan without one', () => {
  expect(renderToStaticMarkup(<PlanMaps maps={[]} />)).toBe('');
  expect(catalogue.projects.find(p => p.id === 'gurrowa-place')!.maps).toEqual([]);
 });
});
