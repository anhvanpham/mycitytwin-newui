import type { FeatureCollection, Polygon } from 'geojson';
import type { Map as LibreMap } from 'maplibre-gl';
import { HODDLE_GRID_RING, HODDLE_GRID_BOUNDS } from './hoddleGrid';
export { HODDLE_GRID_RING, HODDLE_GRID_BOUNDS, isInHoddleGrid } from './hoddleGrid';

/** Fade everything beyond the four boundary streets, including basemap labels. */
export function addHoddleGridFocus(map: LibreMap) {
  if (map.getSource('hoddle-grid')) {
    // Context views add their count labels later; keep the outer wash above them.
    map.moveLayer('hoddle-grid-wash');
    map.moveLayer('hoddle-grid-outline');
    return;
  }
  const data: FeatureCollection<Polygon, { kind: string }> = { type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { kind: 'outside' }, geometry: { type: 'Polygon', coordinates: [
      [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
      [...HODDLE_GRID_RING].reverse(),
    ] } },
    { type: 'Feature', properties: { kind: 'grid' }, geometry: { type: 'Polygon', coordinates: [HODDLE_GRID_RING] } },
  ] };
  map.addSource('hoddle-grid', { type: 'geojson', data });
  map.addLayer({ id: 'hoddle-grid-wash', type: 'fill', source: 'hoddle-grid',
    filter: ['==', 'kind', 'outside'], paint: { 'fill-color': '#f1f5f1', 'fill-opacity': 0.93 } });
  map.addLayer({ id: 'hoddle-grid-outline', type: 'line', source: 'hoddle-grid',
    filter: ['==', 'kind', 'grid'], paint: { 'line-color': '#6f9888', 'line-width': 1.2, 'line-opacity': 0.6 } });
}

/** Fit the whole grid on wide and narrow screens, then constrain navigation to
 * that overview. Using its raw geographic bbox as maxBounds would crop corners
 * when the map's aspect ratio differs from the grid's. */
export function frameHoddleGrid(map: LibreMap) {
  map.setMaxBounds(null);
  map.setMinZoom(13.5);
  map.fitBounds(HODDLE_GRID_BOUNDS, { padding: 24, duration: 0 });
  map.setMaxBounds(map.getBounds());
  map.setMinZoom(map.getZoom());
}

/** Future Plans can reveal the wider city without changing other map boundaries. */
export function setHoddleGridFocus(map: LibreMap, enabled: boolean) {
  if (enabled) addHoddleGridFocus(map);
  for (const layer of ['hoddle-grid-wash', 'hoddle-grid-outline']) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', enabled ? 'visible' : 'none');
  }
}
