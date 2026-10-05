import { useMemo } from 'react';
import type { CityModel } from '../data/model';
import { buildingCentres, buildingsUnder } from '../data/replaces';
import { buildSkyline } from '../scene/skyline';
import { panelDay, type PlacedPanel } from '../scene/solarPanel';
import type { SimulationDate } from '../scene/solar';

export interface SolarSystemResult { count: number; available: number; kwh: number; sunHours: number; shadeLoss: number }
export function useSolarSystem(model: CityModel | null, panels: PlacedPanel[], date: SimulationDate) {
 const serializedRoofs = JSON.stringify(panels.map(({id, roof}) => ({id, roof}))); 
 const horizons = useMemo(() => {
  const roofs = JSON.parse(serializedRoofs) as Pick<PlacedPanel, "id" | "roof">[];
  if (!model) return [];
  const centres = buildingCentres(model.buildings);
  const removed = new Set(model.developments.flatMap(d => buildingsUnder(d.parts.flatMap(p => p.footprint), centres)));
  const afterCity = [...model.buildings.filter(b => !removed.has(b.parentId)), ...model.developments.flatMap(d => d.parts)];
  return roofs.map(({ id, roof }) => ({ id,
   today: roof.kind === 'development' ? null : buildSkyline(roof.en, roof.ahdM + 0.9, model.buildings),
   after: roof.kind !== 'development' && removed.has(roof.buildingId) ? null : buildSkyline(roof.en, roof.ahdM + 0.9, afterCity),
  }));
 // Settings do not change a roof's skyline; keep this expensive work cached.
 }, [model, serializedRoofs]);
 const results = useMemo(() => panels.map(p => {
  const h = horizons.find(h => h.id === p.id);
  return { id: p.id, today: h?.today ? panelDay(date, p.settings, h.today) : null, after: h?.after ? panelDay(date, p.settings, h.after) : null };
 }), [panels, horizons, date]);
 const aggregate = (scenario: 'today' | 'after'): SolarSystemResult => {
  const active = results.map(r => r[scenario]).filter(r => r !== null);
  const kwh = active.reduce((s,d) => s+d.kwh,0);
  const clear = active.reduce((s,d) => s+d.unshadedKwh,0);
  return {count: panels.length, available: active.length, kwh, sunHours: active.length ? active.reduce((s,d) => s+d.sunHours,0)/active.length : 0, shadeLoss: clear ? 100*(1-kwh/clear) : 0};
 };
 return {today: aggregate('today'), after: aggregate('after')};
}
export function solarSystemDifference(today: SolarSystemResult, after: SolarSystemResult) {
 if (today.available !== today.count || after.available !== after.count) return 'Different roofs — no direct comparison.';
 const energy = after.kwh-today.kwh;
 const hours = after.sunHours-today.sunHours;
 return `After: ${Math.abs(energy).toFixed(2)} kWh/day ${energy < 0 ? 'less' : 'more'} · ${Math.abs(hours).toFixed(1)} h sun ${hours < 0 ? 'less' : 'more'}.`;
}
