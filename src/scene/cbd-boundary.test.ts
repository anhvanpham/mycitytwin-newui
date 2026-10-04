import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { projectLonLat } from '../data/project';
import { LOCAL_ORIGIN_WGS84, enuToWorld } from './frame';
import { CBD_RING, CBD_PLANES, CBD_OUTER_PLANES, CBD_FADE_IN_M, CBD_FADE_OUT_M, cbdEdgeVisibility, cbdGroundPlacement, insideCBD } from './cbdBoundary';
import { textureCoordinate } from './basemap';
const origin=projectLonLat(LOCAL_ORIGIN_WGS84.lon,LOCAL_ORIGIN_WGS84.lat);
const point=(lon:number,lat:number):[number,number]=>{const p=projectLonLat(lon,lat);return [p[0]-origin[0],p[1]-origin[1]];};
describe('CBD visual boundary and map alignment',()=>{
  it('includes the central grid and excludes Docklands, Carlton and Southbank',()=>{
    expect(insideCBD(point(144.9631,-37.8142))).toBe(true);
    for(const p of [[144.943,-37.816],[144.967,-37.802],[144.963,-37.824]])expect(insideCBD(point(p[0],p[1]))).toBe(false);
  });
  it('uses world-space clipping planes that keep the CBD interior',()=>{
    const p=point(144.9631,-37.8142),world=new Vector3(...enuToWorld([...p,15]));
    expect(CBD_PLANES.every(plane=>plane.distanceToPoint(world)>0)).toBe(true);
    const outside=point(144.943,-37.816);
    expect(CBD_PLANES.some(plane=>plane.distanceToPoint(new Vector3(...enuToWorld([...outside,15])))<0)).toBe(true);
  });
  it('feathers the scenery gradually without fading the central city',()=>{
    const centre=point(144.9631,-37.8142);
    expect(cbdEdgeVisibility(centre)).toBe(1);
    const a=CBD_RING[0],b=CBD_RING[1],plane=CBD_PLANES[0];
    const edge:[number,number]=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    const offset=(distance:number):[number,number]=>[edge[0]+plane.normal.x*distance,edge[1]-plane.normal.z*distance];
    const inner=cbdEdgeVisibility(offset(CBD_FADE_IN_M+1)),border=cbdEdgeVisibility(edge),outer=cbdEdgeVisibility(offset(-CBD_FADE_OUT_M/2));
    expect(inner).toBe(1);expect(border).toBeGreaterThan(outer);expect(border).toBeLessThan(1);expect(outer).toBeGreaterThan(0);
    const vanished=offset(-CBD_FADE_OUT_M-1);
    expect(cbdEdgeVisibility(vanished)).toBe(0);
    expect(CBD_OUTER_PLANES.some(p=>p.distanceToPoint(new Vector3(...enuToWorld([...vanished,15])))<0)).toBe(true);
    for(const location of [edge,offset(-CBD_FADE_OUT_M)]){
      const uv=textureCoordinate(...location,cbdGroundPlacement().placement);
      for(const v of uv){expect(v).toBeGreaterThan(0);expect(v).toBeLessThan(1);}
    }
  });
  it('covers all CBD corners without stretching the texture past its pixels',()=>{
    const placement=cbdGroundPlacement().placement;
    for(const p of CBD_RING){const [u,v]=textureCoordinate(...p,placement);expect(u).toBeGreaterThan(0);expect(u).toBeLessThan(1);expect(v).toBeGreaterThan(0);expect(v).toBeLessThan(1);}
    expect(placement.widthPx).toBe(2048);
  });
});
