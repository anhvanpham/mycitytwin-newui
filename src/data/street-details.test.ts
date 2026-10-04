import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCityModel } from './adapter';
import type { ApiBuildingPart, ApiDevelopmentPart, ApiFeatureCollection } from './api-types';
import type { StreetDetailsDoc } from './streetDetails';
import { obstacleIndex, clearRect } from './streetGeometry';
import summary from './street-details-summary.json';

const load = <T,>(name: string): T => JSON.parse(readFileSync(resolve(__dirname, '../../public/data', name), 'utf8'));
const doc = load<StreetDetailsDoc>('street-details.json');
const { model } = buildCityModel(load<ApiFeatureCollection<ApiBuildingPart>>('building-footprints.json'), load<ApiFeatureCollection<ApiDevelopmentPart>>('development-footprints.json'), 'snapshot');
const free = obstacleIndex(model.buildings.flatMap(b=>b.footprint));

describe('the bundled CBD street extract', () => {
  it('has complete data and source counts that agree with the shipped file', () => {
    expect(doc.version).toBe(1);
    expect(doc.trees.length).toBe(summary.trees);
    expect(doc.lights.length).toBe(summary.lights);
    expect(doc.crossings.length).toBe(summary.crossings);
    expect(doc.paint.length).toBe(summary.paintPatches);
    expect(summary.trees).toBeGreaterThan(1000);
    expect(summary.lights).toBeGreaterThan(100);
    expect(summary.crossings).toBeGreaterThan(50);
    expect(summary.source.notes).toContain('tree heights are estimated');
    expect(summary.source.notes).toContain('inferred from OSM tags');
  });
  it('uses unique tree and lamp identifiers and metres near the scene origin', () => {
    for (const rows of [doc.trees,doc.lights]) {
      expect(new Set(rows.map(r=>r.id)).size).toBe(rows.length);
      expect(rows.every(r=>Number.isFinite(r.e) && Number.isFinite(r.n) && Math.abs(r.e)<1800 && Math.abs(r.n)<1800)).toBe(true);
    }
  });
  it('puts tree trunks and lamp bases outside the actual model footprints', () => {
    expect(doc.trees.filter(t=>!free([t.e,t.n]))).toHaveLength(0);
    expect(doc.lights.filter(l=>!free([l.e,l.n]))).toHaveLength(0);
  });
  it('keeps paint off buildings and never adds paint to an unmarked crossing', () => {
    expect(doc.paint.filter(p=>!clearRect(p,free))).toHaveLength(0);
    expect(doc.crossings.every(c=>['zebra','lines','dashes','lines:paired'].includes(c.style))).toBe(true);
  });
});

describe('street clipping', () => {
  it('preserves courtyard holes, indexes negative cells and rejects occupied patches', () => {
    const isFree=obstacleIndex([[[[-60,-60],[-40,-60],[-40,-40],[-60,-40]],[[-55,-55],[-45,-55],[-45,-45],[-55,-45]]]]);
    expect(isFree([-50,-50])).toBe(true);
    expect(isFree([-58,-58])).toBe(false);
    expect(isFree([50,50])).toBe(true);
    expect(clearRect({e:-50,n:-50,length:4,width:4,angle:0.4},isFree)).toBe(true);
    expect(clearRect({e:-50,n:-50,length:24,width:1,angle:0},isFree)).toBe(false);
  });
});
