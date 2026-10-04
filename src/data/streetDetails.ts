import { useEffect, useState } from 'react';
import { bundled } from './bundled';
import type { PaintRect } from './streetGeometry';
import type { LightMount } from './lightingImport';

export interface StreetLayers {
  trees?: boolean;
  streetlights?: boolean;
  lightLevels?: boolean;
  roadMarkings?: boolean;
  landmarks?: boolean;
}
export const DEFAULT_STREET_LAYERS = { trees: true, streetlights: true, lightLevels: false, roadMarkings: true, landmarks: true };
export interface StreetTree { id: string; e: number; n: number; species: string;diameterCm: number | null }
export interface StreetLamp { id: string; e: number; n: number; source: 'council' | 'osm'; mount: LightMount; assetIds: string[] }
export interface LightingAsset {
  id: string; e: number; n: number; source: 'council' | 'osm'; mount: LightMount;
  mounting: string | null; lampType: string | null; watts: number | null;
  description: string | null; location: string | null;
}
export interface LightLevel { id: string; e: number; n: number; lux: number; surveyDate: string | null }
export interface StreetDetailsDoc {
  version: number;
  trees: StreetTree[];
  lights: StreetLamp[];
  lightingAssets: LightingAsset[];
  lightLevels: LightLevel[];
  paint: PaintRect[];
  crossings: { id: string; e: number; n: number; style: string }[];
}
export type StreetDataStatus = 'loading' | 'ready' | 'error';

/** One bundled request for the app, shared by both comparison canvases. */
export function useStreetDetails() {
  const [state, setState] = useState<{ doc: StreetDetailsDoc | null; status: StreetDataStatus }>({ doc: null, status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    fetch(bundled('data/street-details.json'), { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Street data unavailable'); return r.json(); })
      .then((doc: StreetDetailsDoc) => {
        if (doc.version !== 2 || !['trees', 'lights', 'lightingAssets', 'lightLevels', 'paint', 'crossings'].every(k => Array.isArray(doc[k as keyof StreetDetailsDoc]))) throw new Error('Invalid street data');
        if (!controller.signal.aborted) setState({ doc, status: 'ready' });
      })
      .catch(() => { if (!controller.signal.aborted) setState({ doc: null, status: 'error' }); });
    return () => controller.abort();
  }, []);
  return state;
}
