import type { LightingAsset, StreetLamp } from './streetDetails';

export type LightMount = 'pole' | 'suspended' | 'wall' | 'low' | 'bridge' | 'unknown';

/** A missing mounting type must never create an invented pole. */
export function lightMount(mounting: string | null): LightMount {
  if (!mounting) return 'unknown';
  if (mounting.startsWith('Pole:')) return 'pole';
  if (/catenary|guy wire/i.test(mounting)) return 'suspended';
  if (/wall/i.test(mounting)) return 'wall';
  if (/bridge/i.test(mounting)) return 'bridge';
  if (/inground|under seat|stairs/i.test(mounting)) return 'low';
  return 'unknown';
}

/** Zero lux is valid; absent, negative and invalid readings are not. */
export function lightLevel(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function surveyDate(value: unknown): string | null {
  const s = String(value ?? '');
  if (!/^\d{8}$/.test(s)) return null;
  const date = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

/** Retain distinct close fixtures. Merge near-identical council records and cross-source matches. */
export function lightingLocations(assets: LightingAsset[], visible: (point: [number, number]) => boolean): StreetLamp[] {
  const lights: StreetLamp[] = [], cells = new Map<string, StreetLamp[]>();
  for (const asset of assets) {
    const {e,n,mount}=asset;
    if (!visible([e,n])) continue;
    const x=Math.floor(e/3),y=Math.floor(n/3);let group:StreetLamp|undefined;
    for(let i=x-1;i<=x+1&&!group;i++)for(let j=y-1;j<=y+1&&!group;j++) {
      group=(cells.get(`${mount}:${i},${j}`)??[]).find(p=>Math.hypot(p.e-e,p.n-n)<(p.source===asset.source?0.5:3));
    }
    if(group){group.assetIds.push(asset.id);continue;}
    const entry={id:asset.id,e,n,source:asset.source,mount,assetIds:[asset.id]};lights.push(entry);
    const key=`${mount}:${x},${y}`,bucket=cells.get(key)??[];bucket.push(entry);cells.set(key,bucket);
  }
  return lights;
}
