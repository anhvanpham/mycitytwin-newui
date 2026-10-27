import type { GeoJSONSource, Map as LibreMap } from 'maplibre-gl';
import { cityFocusMask, type CityFocus } from './cityFocus';

/** Above all basemap labels; project markers and controls remain readable. */
export function addMapFocus(map: LibreMap, focus: CityFocus) {
  const source = map.getSource('city-focus') as GeoJSONSource | undefined;
  if (source) { source.setData(cityFocusMask(focus)); return; }
  map.addSource('city-focus', { type: 'geojson', data: cityFocusMask(focus) });
  map.addLayer({ id: 'city-focus-wash', type: 'fill', source: 'city-focus', paint: {
    'fill-color': '#f1f5f1', 'fill-opacity': ['get', 'opacity'], 'fill-antialias': false,
  } });
}
