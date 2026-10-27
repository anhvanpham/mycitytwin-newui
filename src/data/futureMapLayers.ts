import type { Map as LibreMap } from 'maplibre-gl';
import type { SpatialContext } from './futureContext';

export type ContextView = 'projects' | 'trees' | 'buildings';
export const TREE_SOURCE = 'future-trees';
export const CLUSTERS = 'future-tree-clusters';
export const TREE_POINTS = 'future-tree-points';
const COUNTS = 'future-tree-counts';
const COVERAGE = 'future-building-coverage';
const SELECTED = 'future-selected-block';

/** Keep street names for orientation, but remove symbols competing with project pins. */
export function softenMap(map: LibreMap) {
  for (const layer of map.getStyle().layers) {
    if (/^poi_|shield|one_way_arrow|^label_city/.test(layer.id)) map.setLayoutProperty(layer.id, 'visibility', 'none');
    if (layer.type === 'line' && /^(road|bridge|tunnel)_/.test(layer.id) && !/path|rail|pedestrian/.test(layer.id)) {
      map.setPaintProperty(layer.id, 'line-color', /casing/.test(layer.id) ? '#d8dfd8' : '#fafbf8');
    }
    if (layer.type === 'fill' && layer.id === 'building') map.setPaintProperty(layer.id, 'fill-color', '#d9dfda');
  }
}

export function showContext(map: LibreMap, data: SpatialContext, view: ContextView, blockId: string | null) {
  if (!map.getSource(TREE_SOURCE)) {
    const before = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id;
    map.addSource(TREE_SOURCE, { type: 'geojson', data: data.trees, cluster: true, clusterRadius: 38, clusterMaxZoom: 14 });
    map.addSource('future-blocks', { type: 'geojson', data: data.density });
    map.addLayer({ id: COVERAGE, type: 'fill', source: 'future-blocks', paint: {
      'fill-color': ['interpolate', ['linear'], ['get', 'coverage'], 0, '#e9efeb', 35, '#b5d0c1', 70, '#70a28b', 100, '#477c65'],
      'fill-opacity': 0.52,
    } }, before);
    map.addLayer({ id: SELECTED, type: 'line', source: 'future-blocks', filter: ['==', 'id', ''], paint: { 'line-color': '#285e4b', 'line-width': 2 } }, before);
    map.addLayer({ id: CLUSTERS, type: 'circle', source: TREE_SOURCE, filter: ['has', 'point_count'], paint: {
      'circle-color': '#d4e7d9', 'circle-radius': ['step', ['get', 'point_count'], 15, 100, 19, 1000, 23],
      'circle-stroke-width': 1, 'circle-stroke-color': '#82aa91',
    } }, before);
    map.addLayer({ id: COUNTS, type: 'symbol', source: TREE_SOURCE, filter: ['has', 'point_count'], layout: {
      'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Regular'], 'text-size': 11,
    }, paint: { 'text-color': '#285e4b' } });
    map.addLayer({ id: TREE_POINTS, type: 'circle', source: TREE_SOURCE, filter: ['!', ['has', 'point_count']], paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 1.8, 17, 3.2],
      'circle-color': '#488263', 'circle-opacity': 0.72,
      'circle-stroke-width': 0.5, 'circle-stroke-color': '#f6faf7',
    } }, before);
  }
  for (const id of [CLUSTERS, COUNTS, TREE_POINTS]) map.setLayoutProperty(id, 'visibility', view === 'trees' ? 'visible' : 'none');
  map.setLayoutProperty(COVERAGE, 'visibility', view === 'buildings' ? 'visible' : 'none');
  map.setLayoutProperty(SELECTED, 'visibility', blockId && view !== 'projects' ? 'visible' : 'none');
  map.setFilter(SELECTED, ['==', 'id', blockId ?? '']);
}
