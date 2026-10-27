import { inRing } from './streetGeometry';
import { projectLonLat, unprojectMetric } from './project';

// Restore the original preview outline at the Spencer, Flinders, Spring and
// La Trobe junctions. This is a street-based view, not an administrative boundary.
const corners: [number, number][] = [
  [144.95143, -37.81317], [144.95507, -37.82108],
  [144.97490, -37.81528], [144.97108, -37.80771],
];
const metric = corners.map(([lon, lat]) => projectLonLat(lon, lat));
const centre = metric.reduce<[number, number]>((sum, p) => [sum[0] + p[0] / 4, sum[1] + p[1] / 4], [0, 0]);
// The original 35 m corner margin keeps the boundary streets themselves visible.
const ring = metric.map(([e, n]) => {
  const distance = Math.hypot(e - centre[0], n - centre[1]);
  return unprojectMetric(e + (e - centre[0]) * 35 / distance, n + (n - centre[1]) * 35 / distance);
});
export const HODDLE_GRID_RING: [number, number][] = [...ring, ring[0]];
export const HODDLE_GRID_BOUNDS: [[number, number], [number, number]] = [
  [Math.min(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1]))],
  [Math.max(...ring.map(p => p[0])), Math.max(...ring.map(p => p[1]))],
];
export const isInHoddleGrid = (point: [number, number]) => inRing(point, HODDLE_GRID_RING);

