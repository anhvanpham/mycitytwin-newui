import { describe, expect, it } from 'vitest';
import { lightLevel, lightMount, surveyDate, lightingLocations } from './lightingImport';

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

it('retains distinct nearby fixtures while grouping duplicate positions and cross-source matches',()=>{
  const asset=(id:string,e:number,source:'council'|'osm'='council',mount:'pole'|'low'='pole')=>({id,e,n:0,source,mount,mounting:null,lampType:null,watts:null,description:null,location:null});
  const grouped=lightingLocations([asset('a',0),asset('duplicate',0.2),asset('b',1.2),asset('c',2.4),asset('osm',2,'osm'),asset('ground',0,'council','low'),asset('occupied',20)],([e])=>e<10);
  expect(grouped.map(l=>l.id)).toEqual(['a','b','c','ground']);
  expect(grouped[0].assetIds).toEqual(['a','duplicate','osm']);
});
