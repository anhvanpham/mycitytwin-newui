import { civilToInstant, solarPosition, type SimulationDate } from './solar';
import { SITE } from './frame';
import type { Skyline } from './skyline';
export interface RoofPanel { en: [number, number]; ahdM: number; buildingId: string; kind?: "building" | "development" }
export interface PanelSettings { tilt: number; azimuth: number; watts: number }
export interface PlacedPanel { id: number; setId?: number; roof: RoofPanel; settings: PanelSettings }
export const MAX_PANELS = 20;
export function canPlacePanel(panels: PlacedPanel[], roof: RoofPanel, movingId: number | null) {
 return (movingId !== null || panels.length < MAX_PANELS) && !panels.some(p => p.id !== movingId && Math.abs(p.roof.ahdM - roof.ahdM) < 2 && Math.hypot(p.roof.en[0] - roof.en[0], p.roof.en[1] - roof.en[1]) < 2.2);
}
export const DEFAULT_PANEL: PanelSettings = { tilt: 30, azimuth: 0, watts: 400 };
/** Haurwitz clear-sky GHI; illustrative 15% diffuse split, isotropic sky,
 * 0.2 ground reflectance, 25°C air, NOCT 45°C, -0.4%/°C and 14% system loss.
 * Skyline only masks the direct beam. No partial-panel/string shading model. */
export function panelPower(sun: { altitudeDeg: number; azimuthDeg: number }, panel: PanelSettings, skyline: Skyline | null) {
 const rad = Math.PI / 180;
 const sinAlt = Math.sin(sun.altitudeDeg * rad);
 if (sinAlt <= 0) return { watts: 0, directSun: false };
 const ghi = 1098 * sinAlt * Math.exp(-0.059 / sinAlt);
 const tilt = panel.tilt * rad;
 const incidence = Math.max(0, sinAlt * Math.cos(tilt) + Math.cos(sun.altitudeDeg * rad) * Math.sin(tilt) * Math.cos((sun.azimuthDeg - panel.azimuth) * rad));
 const bucket = ((Math.round(sun.azimuthDeg) % 360) + 360) % 360;
 const visible = !skyline || sun.altitudeDeg > skyline[bucket];
 const beam = visible ? 0.85 * ghi / sinAlt * incidence : 0;
 const diffuse = 0.15 * ghi * (1 + Math.cos(tilt)) / 2;
 const reflected = ghi * 0.2 * (1 - Math.cos(tilt)) / 2;
 const poa = beam + diffuse + reflected;
 const cellC = 25 + (45 - 20) / 800 * poa;
 return { watts: Math.max(0, panel.watts * poa / 1000 * (1 - 0.004 * (cellC - 25)) * 0.86), directSun: visible && incidence > 0 };
}
export function panelDay(date: SimulationDate, settings: PanelSettings, skyline: Skyline | null) {
 const samples: { minutes: number; watts: number }[] = [];
 let wh = 0, unshadedWh = 0, sunMinutes = 0;
 for (let minutes = 0; minutes < 1440; minutes += 10) {
  const sun = solarPosition(civilToInstant(SITE.timeZone, date.year, date.month, date.day, Math.floor((minutes + 5) / 60), (minutes + 5) % 60), SITE);
  const power = panelPower(sun, settings, skyline);
  wh += power.watts / 6;
  unshadedWh += panelPower(sun, settings, null).watts / 6;
  if (power.directSun) sunMinutes += 10;
  samples.push({ minutes: minutes + 5, watts: power.watts });
 }
 return { samples, unshadedKwh: unshadedWh / 1000, kwh: wh / 1000, sunHours: sunMinutes / 60, shadingLoss: unshadedWh > 0 ? 100 * (1 - wh / unshadedWh) : 0 };
}
