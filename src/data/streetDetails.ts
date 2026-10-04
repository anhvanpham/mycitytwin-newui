import { useEffect, useState } from 'react';
import { bundled } from './bundled';
import type { PaintRect } from './streetGeometry';

export interface StreetLayers {
  trees?: boolean;
  streetlights?: boolean;
  roadMarkings?: boolean;
  landmarks?: boolean;
}
export const DEFAULT_STREET_LAYERS = { trees: true, streetlights: true, roadMarkings: true, landmarks: true };
export interface StreetTree { id: string; e: number; n: number; species: string;diameterCm: number | null }
export interface StreetLamp { id: string; e: number; n: number; source: 'council' | 'osm' }
export interface StreetDetailsDoc {
  version: number;
  trees: StreetTree[];
  lights: StreetLamp[];
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
        if (doc.version !== 1 || !['trees', 'lights', 'paint', 'crossings'].every(k => Array.isArray(doc[k as keyof StreetDetailsDoc]))) throw new Error('Invalid street data');
        if (!controller.signal.aborted) setState({ doc, status: 'ready' });
      })
      .catch(() => { if (!controller.signal.aborted) setState({ doc: null, status: 'error' }); });
    return () => controller.abort();
  }, []);
  return state;
}
