import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCityModel } from './adapter';
import type { ApiBuildingPart, ApiDevelopmentPart, ApiFeatureCollection } from './api-types';
import type { StreetDetailsDoc } from './streetDetails';
import { obstacleIndex, clearRect } from './streetGeometry';
import summary from './street-details-summary.json';
import { fixtureHeight } from '../scene/streetAppearance';

const load = <T,>(name: string): T => JSON.parse(readFileSync(resolve(__dirname, '../../public/data', name), 'utf8'));
const doc = load<StreetDetailsDoc>('street-details.json');
const { model } = buildCityModel(load<ApiFeatureCollection<ApiBuildingPart>>('building-footprints.json'), load<ApiFeatureCollection<ApiDevelopmentPart>>('development-footprints.json'), 'snapshot');
const free = obstacleIndex(model.buildings.flatMap(b=>b.footprint));

describe('the bundled CBD street extract', () => {
  it('has complete data and source counts that agree with the shipped file', () => {
    expect(doc.version).toBe(2);
    expect(doc.trees.length).toBe(summary.trees);
    expect(doc.lights.length).toBe(summary.lights);
    expect(doc.crossings.length).toBe(summary.crossings);
    expect(doc.paint.length).toBe(summary.paintPatches);
    expect(doc.lightingAssets.length).toBe(summary.lightingAssets);
    expect(doc.lightLevels.length).toBe(summary.lightLevels);
    expect(summary.trees).toBeGreaterThan(1000);
    expect(summary.lights).toBeGreaterThan(100);
    expect(summary.crossings).toBeGreaterThan(50);
    expect(summary.source.notes).toContain('tree heights are estimated');
    expect(summary.source.notes).toContain('inferred from OSM tags');
  });
  it('retains all fixtures separately from grouped visual locations and historical samples', () => {
    const assets=new Set(doc.lightingAssets.map(p=>p.id));
    expect(assets.size).toBe(doc.lightingAssets.length);
    expect(doc.lightingAssets.filter(p=>p.source==='council')).toHaveLength(summary.councilAssets);
    expect(summary.councilAssets).toBe(2242);
    expect(doc.lights.every(p=>p.assetIds.length>0&&p.assetIds.every(id=>assets.has(id)))).toBe(true);
    for(const mount of ['pole','suspended','wall','bridge','low','unknown'] as const) {
      expect(doc.lights.filter(p=>p.mount===mount)).toHaveLength(summary.lightMounts[mount]);
      expect(doc.lightingAssets.some(p=>p.mount===mount)).toBe(true);
    }
    expect(fixtureHeight('unknown')).toBeLessThan(1);
    expect(fixtureHeight('low')).toBeLessThan(fixtureHeight('wall'));
    expect(fixtureHeight('wall')).toBeLessThan(fixtureHeight('pole'));
  });
  it('ships no packed visual light groups while retaining source assets',()=>{
    let minimum=Infinity;
    for(let i=0;i<doc.lights.length;i++)for(let j=i+1;j<doc.lights.length;j++) {
      minimum=Math.min(minimum,Math.hypot(doc.lights[i].e-doc.lights[j].e,doc.lights[i].n-doc.lights[j].n));
    }
    expect(minimum).toBeGreaterThanOrEqual(12);
    expect(doc.lightingAssets.length).toBe(2342);
  });
  it('keeps historical lux values, dates and sample identifiers without inventing poles', () => {
    expect(new Set(doc.lightLevels.map(p=>p.id)).size).toBe(doc.lightLevels.length);
    expect(doc.lightLevels.every(p=>Number.isFinite(p.lux)&&p.lux>=0&&p.surveyDate==='2014-09-16'&&Number.isFinite(p.e)&&Number.isFinite(p.n))).toBe(true);
    expect(doc.lightLevels.length).toBeGreaterThan(35000);
    expect(summary.source.surveyDates).toEqual(['2014-09-16']);
    expect(summary.source.notes).toContain('not lamp positions or current illumination');
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
