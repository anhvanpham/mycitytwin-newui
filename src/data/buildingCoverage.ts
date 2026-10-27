import type { ApiBuildingPart, ApiFeatureCollection } from './api-types';
/** Core API geometry is authoritative wherever it supplies a structure.
 * The separate council supplement stays present when the core live API refreshes.
 */
export function withFringe(core: ApiFeatureCollection<ApiBuildingPart>, fringe: ApiFeatureCollection<ApiBuildingPart>): ApiFeatureCollection<ApiBuildingPart> {
  const known = new Set(core.features.map(f => String(f.properties.structureId)));
  return { ...core, name: 'Melbourne CBD and fringe building footprints', features: [...core.features, ...fringe.features.filter(f => !known.has(String(f.properties.structureId)))] };
}
