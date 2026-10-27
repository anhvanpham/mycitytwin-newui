import { bundled } from './bundled';
import type { FeatureCollection, Polygon, Point } from 'geojson';
export type Cell = { id: string; coverage: number; buildings: number; trees: number; treesPerHa: number };
export type SpatialContext = {
  version: number; generatedAt: string;
  sources: { buildings: string; buildingYear: number; trees: string; treesRetrievedAt: string };
  method: { cellSizeM: number; sampleStepM: number; coverage: string; treeMeasure: string };
  thresholds: { highCoverage: number; lowTrees: number };
  density: FeatureCollection<Polygon, Cell>; trees: FeatureCollection<Point>;
};
export function cellAt(context: SpatialContext, [lon, lat]: [number, number]): Cell | null {
  return context.density.features.find(feature => {
    const ring=feature.geometry.coordinates[0]; let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const [xi,yi]=ring[i], [xj,yj]=ring[j];
      if(((yi>lat)!==(yj>lat))&&lon<(xj-xi)*(lat-yi)/(yj-yi)+xi) inside=!inside;
    }
    return inside;
  })?.properties ?? null;
}
export function contextAdvice(cell: Cell, context: SpatialContext): string {
  const compact = cell.coverage >= context.thresholds.highCoverage;
  const fewerTrees = cell.trees <= context.thresholds.lowTrees;
  if (compact && fewerTrees) return 'This block combines higher mapped building coverage with fewer recorded trees than many sampled CBD blocks. Explore walking-space improvements and opportunities for planting together; a site assessment would need to check available space and underground services.';
  if (compact) return 'This block has higher mapped building coverage and an established tree inventory. Explore how walking routes, building entrances and existing trees can work together, including retaining trees when street space changes.';
  if (fewerTrees) return 'This block has relatively few recorded trees. Compare the urban forest plan with public-space proposals to explore planting opportunities; open space on this map may include roads or private land.';
  return 'Explore how existing trees connect walking routes and public spaces here. Compare related plans before assuming a new building or transport project will add or remove trees.';
}

/** Optional context loads only when a reader chooses Trees or Buildings. */
export async function loadSpatialContext(signal: AbortSignal): Promise<SpatialContext> {
  const configured = import.meta.env.VITE_FUTURE_API_URL as string | undefined;
  const api = configured?.replace(/\/$/, '') ?? '/future-api';
  const read = async (url: string, timeout: number) => {
    const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]) });
    if (!response.ok) throw new Error('City context unavailable');
    const data = await response.json() as SpatialContext;
    if (data?.density?.type !== 'FeatureCollection' || data?.trees?.type !== 'FeatureCollection'
      || !Array.isArray(data.density.features) || !Array.isArray(data.trees.features)
      || !data.sources || !data.method || !data.thresholds) throw new Error('Invalid city context');
    return data;
  };
  if (api) {
    try { return await read(`${api}/api/spatial-context`, 4000); }
    catch (error) { if (signal.aborted) throw error; }
  }
  return read(bundled('data/future-context.json'), 10000);
}
