import type { FeatureCollection, Polygon } from 'geojson';
import type { CityModel } from './model';
import snapshotExtent from './landing-map-focus.json';
import { projectLonLat, unprojectMetric } from './project';
import { LOCAL_ORIGIN_WGS84 } from '../scene/frame';

export type CityFocus = { centreE: number; centreN: number; innerM: number; outerM: number };
const origin = projectLonLat(LOCAL_ORIGIN_WGS84.lon, LOCAL_ORIGIN_WGS84.lat);

/** The landing page's existing ground haze, in scene metres. */
export function landingCityFocus(extent: CityModel['extent'] = snapshotExtent): CityFocus {
  const span = Math.max(extent.maxE - extent.minE, extent.maxN - extent.minN);
  return { centreE: (extent.minE + extent.maxE) / 2, centreN: (extent.minN + extent.maxN) / 2, innerM: span * 0.62, outerM: span * 1.2 };
}
export function focusVisibility([e, n]: [number, number], focus: CityFocus): number {
  const distance = Math.hypot(e - focus.centreE, n - focus.centreN);
  const t = Math.min(1, Math.max(0, (distance - focus.innerM) / (focus.outerM - focus.innerM)));
  return 1 - t * t * (3 - 2 * t);
}
function circle(focus: CityFocus, radius: number): [number, number][] {
  return Array.from({ length: 193 }, (_, i) => {
    const angle = (i % 192) * 2 * Math.PI / 192;
    return unprojectMetric(origin[0] + focus.centreE + radius * Math.cos(angle), origin[1] + focus.centreN + radius * Math.sin(angle));
  });
}
/** The same centre, clear radius, smoothstep fade and outer radius as the landing page. */
export function cityFocusMask(focus: CityFocus = landingCityFocus()): FeatureCollection<Polygon, { opacity: number }> {
  const steps = 64;
  const rings = Array.from({ length: steps + 1 }, (_, i) => circle(focus, focus.innerM + (focus.outerM - focus.innerM) * i / steps));
  const features: FeatureCollection<Polygon, { opacity: number }>['features'] = rings.slice(1).map((ring, i) => {
    const t = (i + 0.5) / steps;
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring, [...rings[i]].reverse()] }, properties: { opacity: t * t * (3 - 2 * t) } };
  });
  features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [
    [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], [...rings[steps]].reverse(),
  ] }, properties: { opacity: 1 } });
  return { type: 'FeatureCollection', features };
}

/** Frame the landing page's clear city and a little of its fade for orientation. */
export function focusMapBounds(focus: CityFocus): [[number, number], [number, number]] {
  const points=circle(focus,focus.innerM*1.08);
  return [[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],
    [Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]];
}
