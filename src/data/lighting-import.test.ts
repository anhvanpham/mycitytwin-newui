import { describe, expect, it } from 'vitest';
import { lightLevel, lightMount, surveyDate, lightingLocations, showLightingAsset, removeLightClusters } from './lightingImport';

describe('council lighting records', () => {
  it('preserves mounting distinctions and never calls a missing mount a pole', () => {
    expect(lightMount('Pole: Multiple Fixed')).toBe('pole');
    expect(lightMount('Guy Wire (Catenary)')).toBe('suspended');
    expect(lightMount('Wall')).toBe('wall');
    expect(lightMount('Bridge Beam')).toBe('bridge');
    for (const mounting of ['Under Seat', 'Stairs', 'Inground']) expect(lightMount(mounting)).toBe('low');
    expect(lightMount(null)).toBe('unknown');
    expect(lightMount('Unrecognised')).toBe('unknown');
  });
  it('retains darkness measurements while rejecting missing or invalid values', () => {
    expect(lightLevel('0')).toBe(0);
    expect(lightLevel('62.659')).toBe(62.659);
    for (const value of [null, undefined, '', ' ', 'no data', -1, Infinity, NaN]) expect(lightLevel(value)).toBeNull();
  });
  it('retains the actual historical survey date, rejecting malformed dates', () => {
    expect(surveyDate('20140916')).toBe('2014-09-16');
    for (const date of [null, '20260230', '20141316', '2014']) expect(surveyDate(date)).toBeNull();
  });
});

it('groups duplicate positions and cross-source matches before spacing the visual lights',()=>{
  const asset=(id:string,e:number,source:'council'|'osm'='council',mount:'pole'|'low'='pole')=>({id,e,n:0,source,mount,mounting:null,lampType:null,watts:null,description:null,location:null});
  const grouped=lightingLocations([asset('a',0),asset('duplicate',0.2),asset('b',15),asset('c',30),asset('osm',2,'osm'),asset('ground',45,'council','low'),asset('occupied',60)],([e])=>e<50);
  expect(grouped.map(l=>l.id)).toEqual(['a','b','c','ground']);
  expect(grouped[0].assetIds).toEqual(['a','duplicate','osm']);
});

it.each([
  'Feature Lighting - Intersection of Lonsdale Street and Russell Street',
  'Feature Lighting - Intersection of Russell Street and Little Bourke Street',
])('omits decorative array %s without hiding neighbouring street lamps',description=>{
  const asset={id:'council-array',e:583,n:423,source:'council' as const,mount:'pole' as const,mounting:'Pole: Multiple Fixed',lampType:null,watts:null,description,location:null};
  expect(showLightingAsset(asset)).toBe(false);
  const neighbour={...asset,id:'neighbour',description:'Feature Lighting - Lonsdale Street'};
  expect(showLightingAsset(neighbour)).toBe(true);
  expect(lightingLocations([asset,neighbour],()=>true).map(l=>l.id)).toEqual(['neighbour']);
});

it('omits the two compact Russell/Little Bourke gateway arrays while preserving adjacent street fixtures',()=>{
  const asset={id:'gateway',e:640,n:318,source:'council' as const,mount:'pole' as const,mounting:'Pole: Multiple Fixed',lampType:null,watts:null,description:'Feature Lighting - Little Bourke Street between Exhibition Street and Russell Street',location:null};
  expect(showLightingAsset(asset)).toBe(false);
  expect(showLightingAsset({...asset,e:607,n:303})).toBe(false);
  expect(showLightingAsset({...asset,e:650})).toBe(true);
  expect(showLightingAsset({...asset,mounting:'Pole: Single Fixed'})).toBe(true);
  expect(showLightingAsset({...asset,source:'osm'})).toBe(true);
});

const fixture=(id:string,e:number,n=0,mount:'pole'|'low'|'suspended'='pole')=>({id,e,n,source:'council' as const,mount,assetIds:[id]});
it('removes complete dense grids and connected rows across mounting types and negative coordinates',()=>{
  const cluster=[fixture('a',-4,-2),fixture('b',0,-2),fixture('c',4,-2,'low'),fixture('d',10,-2,'suspended')];
  const isolated=[fixture('street-a',40),fixture('street-b',60)];
  expect(removeLightClusters([...cluster,...isolated])).toEqual(isolated);
  expect(removeLightClusters([...isolated,...cluster].reverse())).toEqual(isolated);
});
it('spaces the remaining lights while preserving isolated ordinary fixtures',()=>{
  const input=[fixture('a',0),fixture('b',10),fixture('c',25),fixture('d',25,20,'low')];
  const spaced=removeLightClusters(input);
  expect(spaced.map(l=>l.id)).toEqual(['a','c','d']);
  for(let i=0;i<spaced.length;i++)for(let j=i+1;j<spaced.length;j++)expect(Math.hypot(spaced[i].e-spaced[j].e,spaced[i].n-spaced[j].n)).toBeGreaterThanOrEqual(12);
  expect(removeLightClusters([])).toEqual([]);
});
