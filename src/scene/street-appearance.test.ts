import { describe, expect, it } from 'vitest';
import { treeDimensions, streetlightPower } from './streetAppearance';
import { civilToInstant, solarPosition } from './solar';
import { SITE } from './frame';

describe('illustrative tree dimensions',()=>{
  it('keeps a larger recorded trunk taller than a young tree, with a bounded crown',()=>{
    const young=treeDimensions(10,'Elm'),mature=treeDimensions(80,'Elm');
    expect(mature.heightM).toBeGreaterThan(young.heightM);
    expect(mature.trunkRadiusM).toBeGreaterThan(young.trunkRadiusM);
    expect(mature.crownHeightM).toBeLessThan(mature.heightM);
  });
  it('handles missing and invalid diameters without invisible or oversized trees',()=>{
    for(const d of [null,0,-5,NaN,Infinity])expect(treeDimensions(d,'Tree')).toEqual(treeDimensions(30,'Tree'));
    expect(treeDimensions(10000,'Tree').heightM).toBeLessThanOrEqual(22);
    expect(treeDimensions(0.1,'Tree').heightM).toBeGreaterThanOrEqual(4);
  });
  it('uses a narrower, higher crown for palms',()=>{
    const palm=treeDimensions(60,'Canary Island Palm'),elm=treeDimensions(60,'Elm');
    expect(palm.crownHeightM).toBeLessThan(elm.crownHeightM);
    expect(palm.crownRadiusM).toBeLessThan(elm.crownRadiusM);
  });
});
describe('automatic streetlights',()=>{
  it('stays off in daylight and on through the night, without invalid brightness',()=>{
    expect(streetlightPower(30)).toBe(0);expect(streetlightPower(-20)).toBe(1);
    expect(streetlightPower(NaN)).toBe(0);
  });
  it('fades through dusk and dawn rather than flicking a binary switch',()=>{
    const values=[2,0,-1,-3,-6].map(streetlightPower);
    expect(values[0]).toBe(0);expect(values[4]).toBe(1);
    expect(values[1]).toBeGreaterThan(0);expect(values[3]).toBeLessThan(1);
    expect(values).toEqual([...values].sort((a,b)=>a-b));
  });
  it('uses seasonal sunset instead of a hard-coded evening hour',()=>{
    const power=(date:string)=>{const [year,month,day]=date.split('-').map(Number);return streetlightPower(solarPosition(civilToInstant(SITE.timeZone,year,month,day,18),SITE).altitudeDeg);};
    expect(power('2026-06-21')).toBe(1);
    expect(power('2026-12-21')).toBe(0);
  });
});
