import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withFringe } from './buildingCoverage';
import { buildCityModel } from './adapter';
import type { ApiBuildingPart, ApiDevelopmentPart, ApiFeatureCollection } from './api-types';
const core=JSON.parse(readFileSync('public/data/building-footprints.json','utf8')) as ApiFeatureCollection<ApiBuildingPart>;
const fringe=JSON.parse(readFileSync('public/data/building-fringe.json','utf8')) as ApiFeatureCollection<ApiBuildingPart>;
const developments=JSON.parse(readFileSync('public/data/development-footprints.json','utf8')) as ApiFeatureCollection<ApiDevelopmentPart>;
describe('CBD plus fringe coverage',()=>{
  it('adds real geometry north of Victoria Street and across all four fringe directions',()=>{
    const points=fringe.features.flatMap(f=>f.geometry?.coordinates.flat(2)??[]);
    expect(points.some(p=>p[1]>-37.806)).toBe(true);
    expect(points.some(p=>p[1]<-37.824)).toBe(true);
    expect(points.some(p=>p[0]<144.947)).toBe(true);
    expect(points.some(p=>p[0]>144.978)).toBe(true);
  });
  it('keeps core properties and replaces overlapping supplemental structures as a whole',()=>{
    const duplicate={...fringe.features[0],properties:{...fringe.features[0].properties,structureId:core.features[0].properties.structureId}};
    const merged=withFringe(core,{...fringe,features:[duplicate,...fringe.features]});
    expect(merged.features[0]).toBe(core.features[0]);
    expect(merged.features).not.toContain(duplicate);
    expect(merged.features).toHaveLength(core.features.length+fringe.features.length);
  });
  it('keeps the fringe when the smaller live API refreshes',()=>{
    const expanded=withFringe(core,fringe);
    const {model,report}=buildCityModel(expanded,developments,'live');
    expect(report.buildings).toBe(6943);
    expect(report.buildingParts).toBe(16545);
    expect(model.buildings.some(b=>b.parentId.startsWith('council-structure:'))).toBe(true);
    expect(model.extent.maxN-model.extent.minN).toBeGreaterThan(3400);
  });
});
