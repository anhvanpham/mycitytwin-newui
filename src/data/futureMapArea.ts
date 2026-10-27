import coverage from './city-coverage-summary.json';
import { isInHoddleGrid } from './hoddleGrid';

export type FutureMapArea = 'grid' | 'city' | 'all';
export const futureMapAreas: { id: FutureMapArea; label: string }[] = [
  { id: 'city', label: 'CBD + fringe' },
  { id: 'grid', label: 'Hoddle Grid' },
  { id: 'all', label: 'All projects' },
];
export const CITY_MAP_BOUNDS: [[number, number], [number, number]] = [
  [coverage.bounds.west, coverage.bounds.south], [coverage.bounds.east, coverage.bounds.north],
];
export function projectInMapArea(point: [number, number], area: FutureMapArea) {
  if (area === 'all') return true;
  if (area === 'grid') return isInHoddleGrid(point);
  const [lon, lat] = point;
  return lon >= coverage.bounds.west && lon <= coverage.bounds.east
    && lat >= coverage.bounds.south && lat <= coverage.bounds.north;
}
// Restore the closer CBD street overview; the wider modes remain freely navigable.
export const CITY_VIEW_BOUNDS: [[number, number], [number, number]] = [[144.949, -37.823], [144.974, -37.803]];

/** Fit this year's project locations, including projects beyond the central city. */
export function projectMapBounds(points: [number, number][]): [[number, number], [number, number]] {
  if (!points.length) return CITY_MAP_BOUNDS;
  const lons=points.map(p=>p[0]),lats=points.map(p=>p[1]);
  const west=Math.min(...lons),east=Math.max(...lons),south=Math.min(...lats),north=Math.max(...lats);
  // A single point, or points along one street, still need a readable neighbourhood.
  return [[west-(east-west<0.008?0.004:0),south-(north-south<0.008?0.004:0)],
    [east+(east-west<0.008?0.004:0),north+(north-south<0.008?0.004:0)]];
}
