import { describe, expect, it } from 'vitest';
import context from '../../public/data/future-context.json';
import catalogue from '../../public/data/future-cbd.json';
import { cellAt, contextAdvice, type SpatialContext } from './futureContext';
import { relatedPlans } from './relatedPlans';
import type { Project } from './futureCatalogue';
const data=context as SpatialContext;
describe('spatial context and linked plans', () => {
  it('does not call places outside the extract empty or low density', () => { expect(cellAt(data,[144.8326,-37.788])).toBeNull(); });
  it('finds a block using its actual polygon', () => {
    const f=data.density.features[0],r=f.geometry.coordinates[0];
    expect(cellAt(data,[(r[0][0]+r[2][0])/2,(r[0][1]+r[2][1])/2])?.id).toBe(f.properties.id);
  });
  it('links the city transport strategy to walking, public space and greening projects',()=> {
    const linked=relatedPlans('transport',catalogue.projects as Project[]).map(p=>p.project.id);
    expect(linked).toContain('central-city-urban-forest');expect(linked).toContain('franklin-street');expect(linked).not.toContain('state-library-overstation');
  });
  it('samples the fringe with real building geometry and recorded trees', () => {
    for (const point of [[144.958, -37.803], [144.943, -37.816], [144.963, -37.824], [144.978, -37.812]] as [number, number][]) {
      expect(cellAt(data, point)).not.toBeNull();
    }
    expect(data.trees.features.some(f => f.geometry.coordinates[1] > -37.806)).toBe(true);
    expect(new Set(data.trees.features.map(f => f.properties?.id)).size).toBe(data.trees.features.length);
  });
  it('makes an exploratory recommendation for high coverage and few recorded trees',()=> {
    const advice=contextAdvice({id:'test',coverage:90,buildings:10,trees:0,treesPerHa:0},data);
    expect(advice).toContain('walking-space improvements');expect(advice).toContain('site assessment');
  });
});
