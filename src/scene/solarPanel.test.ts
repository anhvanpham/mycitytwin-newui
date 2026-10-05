import { describe, it, expect } from 'vitest';
import { panelPower, panelDay, DEFAULT_PANEL, canPlacePanel, MAX_PANELS, type PlacedPanel } from './solarPanel';
describe('rooftop generation', () => {
 it('produces no power at night', () => { expect(panelPower({altitudeDeg:-5,azimuthDeg:0},DEFAULT_PANEL,null).watts).toBe(0); });
 it('retains diffuse light while blocking direct sun', () => {
  const sun={altitudeDeg:40,azimuthDeg:0};
  const open=panelPower(sun,DEFAULT_PANEL,null),shaded=panelPower(sun,DEFAULT_PANEL,new Float32Array(360).fill(80));
  expect(shaded.directSun).toBe(false); expect(shaded.watts).toBeGreaterThan(0); expect(shaded.watts).toBeLessThan(open.watts);
 });
 it('favours a panel facing the sun over one facing away',()=>{
  const sun={altitudeDeg:40,azimuthDeg:0};
  expect(panelPower(sun,DEFAULT_PANEL,null).watts).toBeGreaterThan(panelPower(sun,{...DEFAULT_PANEL,azimuth:180},null).watts);
 });
 it('integrates watts into kWh and respects Melbourne summer daylight',()=>{
  const day=panelDay({year:2026,month:12,day:21}, {...DEFAULT_PANEL,tilt:0},null);
  expect(day.kwh).toBeCloseTo(day.samples.reduce((s,p)=>s+p.watts/6/1000,0),10);
  expect(day.sunHours).toBeGreaterThan(14); expect(day.shadingLoss).toBe(0);
  const shaded=panelDay({year:2026,month:12,day:21},DEFAULT_PANEL,new Float32Array(360).fill(90));
  expect(shaded.sunHours).toBe(0);expect(shaded.shadingLoss).toBeGreaterThan(50);
 });
});

describe('multiple rooftop panels',()=>{
 const roof={en:[0,0] as [number,number],ahdM:50,buildingId:'roof'};
 const panels:PlacedPanel[]=Array.from({length:MAX_PANELS},(_,id)=>({id,roof:{...roof,en:[id*3,0]},settings:DEFAULT_PANEL}));
 it('caps additions at 20 but allows moving an existing panel',()=>{
  expect(canPlacePanel(panels,{...roof,en:[100,0]},null)).toBe(false);
  expect(canPlacePanel(panels,{...roof,en:[100,0]},0)).toBe(true);
 });
 it('prevents overlapping panel placements on the same roof height',()=>{
  expect(canPlacePanel(panels.slice(0,1),{...roof,en:[1,0]},null)).toBe(false);
  expect(canPlacePanel(panels.slice(0,1),{...roof,en:[3,0]},null)).toBe(true);
  expect(canPlacePanel(panels.slice(0,1),{...roof,ahdM:100},null)).toBe(true);
 });
});
