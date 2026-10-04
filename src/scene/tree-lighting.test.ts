import { describe, expect, it } from 'vitest';
import { treeLanterns } from './treeLighting';
const tree=(id:string,e:number,n=0)=>({id,e,n,species:'Elm',diameterCm:30});
describe('decorative tree lantern placements',()=>{
  it('spaces out dense planting and handles negative grid coordinates',()=>{
    const lamps=treeLanterns([tree('a',-7),tree('b',-6),tree('c',0),tree('d',6)]);
    expect(lamps.map(l=>l.e)).toEqual([-7,0,6]);
    for(let i=0;i<lamps.length;i++)for(let j=i+1;j<lamps.length;j++)expect(Math.hypot(lamps[i].e-lamps[j].e,lamps[i].n-lamps[j].n)).toBeGreaterThanOrEqual(6);
  });
  it('uses stable recorded tree positions without creating mapped lamp IDs',()=>{
    const trees=[tree('b',20,5),tree('a',0,5)];
    expect(treeLanterns(trees)).toEqual(treeLanterns([...trees].reverse()));
    expect(treeLanterns(trees).every(l=>l.id.startsWith('decorative-tree-')&&l.height===2.1)).toBe(true);
    expect(treeLanterns([])).toEqual([]);
  });
});
