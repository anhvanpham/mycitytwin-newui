import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCityModel } from './adapter';
import { withFringe } from './buildingCoverage';
import { cityFocusMask, focusVisibility, landingCityFocus } from './cityFocus';
import snapshotExtent from './landing-map-focus.json';
import { projectLonLat } from './project';
import { groundPlacement } from '../scene/basemap';
import { LOCAL_ORIGIN_WGS84 } from '../scene/frame';
import { cbdFadeUniforms } from '../scene/cbdFade';
import { CBD_PLANES, CBD_RING } from '../scene/cbdBoundary';
import { HODDLE_GRID_RING } from './hoddleGrid';

const core=JSON.parse(readFileSync('public/data/building-footprints.json','utf8'));
const fringe=JSON.parse(readFileSync('public/data/building-fringe.json','utf8'));
const developments=JSON.parse(readFileSync('public/data/development-footprints.json','utf8'));
const {model}=buildCityModel(withFringe(core,fringe),developments,'snapshot');
const focus=landingCityFocus(model.extent);
const origin=projectLonLat(LOCAL_ORIGIN_WGS84.lon,LOCAL_ORIGIN_WGS84.lat);
const point=(lon:number,lat:number):[number,number]=>{const p=projectLonLat(lon,lat);return [p[0]-origin[0],p[1]-origin[1]];};
describe('saved circular focus geometry and the restored shared grid boundary',()=>{
  it('uses the actual landing model extent for the saved fallback',()=>{
    for(const key of ['minE','minN','maxE','maxN'] as const)expect(snapshotExtent[key]).toBeCloseTo(model.extent[key],6);
    const ground=groundPlacement(model.extent);
    expect(focus).toEqual({centreE:ground.centreE,centreN:ground.centreN,innerM:ground.span*.62,outerM:ground.size*.5});
  });
  it('keeps the CBD and fringe clear and fades the outer city',()=>{
    for(const p of [[144.943,-37.816],[144.967,-37.802],[144.963,-37.824],[144.978,-37.812]])expect(focusVisibility(point(p[0],p[1]),focus)).toBe(1);
    expect(focusVisibility([focus.centreE+focus.outerM,focus.centreN],focus)).toBe(0);
    const middle=(focus.innerM+focus.outerM)/2;
    expect(focusVisibility([focus.centreE+middle,focus.centreN],focus)).toBeCloseTo(.5);
  });
  it('shares the timeline polygon and projected fade planes with every city scene',()=>{
    const uniforms=cbdFadeUniforms();
    HODDLE_GRID_RING.slice(0,-1).forEach(([lon,lat],i)=>{
      const p=point(lon,lat);
      expect(CBD_RING[i][0]).toBeCloseTo(p[0],6);
      expect(CBD_RING[i][1]).toBeCloseTo(p[1],6);
    });
    expect(uniforms.cbdFadePlanes.value.map(p=>p.toArray())).toEqual(CBD_PLANES.map(p=>[p.normal.x,p.normal.z,p.constant,0]));
  });
  it('leaves a clear circular hole in the 2D map and uses the landing smoothstep curve',()=>{
    const mask=cityFocusMask(focus);
    const first=mask.features[0],inner=first.geometry.coordinates[1][0];
    const p=point(inner[0],inner[1]);
    expect(Math.hypot(p[0]-focus.centreE,p[1]-focus.centreN)).toBeCloseTo(focus.innerM,4);
    for(const feature of mask.features.slice(0,-1)){
      const outer=feature.geometry.coordinates[0][0],inside=feature.geometry.coordinates[1][0];
      const a=point(outer[0],outer[1]),b=point(inside[0],inside[1]);
      const mid:[number,number]=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      expect(feature.properties.opacity).toBeCloseTo(1-focusVisibility(mid,focus),6);
    }
    expect(mask.features.at(-1)?.properties.opacity).toBe(1);
    const updated=landingCityFocus({...model.extent,minE:model.extent.minE-1000});
    expect(updated.centreE).not.toBe(focus.centreE);
    expect(cityFocusMask(updated).features[0].geometry.coordinates).not.toEqual(first.geometry.coordinates);
  });
});
