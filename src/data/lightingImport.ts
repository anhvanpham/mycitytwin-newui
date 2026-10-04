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

/** Dense decorative intersection arrays do not make useful individual street-pole geometry. */
export function showLightingAsset(asset: LightingAsset): boolean {
  if (asset.source !== 'council') return true;
  const gatewayArray = asset.mounting === 'Pole: Multiple Fixed'
    && (asset.description ?? '').startsWith('Feature Lighting - Little Bourke Street between')
    && [[640,318],[607,303]].some(([e,n])=>Math.hypot(asset.e-e,asset.n-n)<6);
  return !gatewayArray && ![
    'Feature Lighting - Intersection of Lonsdale Street and Russell Street',
    'Feature Lighting - Intersection of Russell Street and Little Bourke Street',
  ].includes(asset.description ?? '');
}

/** Retain distinct close fixtures. Merge near-identical council records and cross-source matches. */
export function lightingLocations(assets: LightingAsset[], visible: (point: [number, number]) => boolean): StreetLamp[] {
  const lights: StreetLamp[] = [], cells = new Map<string, StreetLamp[]>();
  for (const asset of assets) {
    const {e,n,mount}=asset;
    if (!showLightingAsset(asset) || !visible([e,n])) continue;
    const x=Math.floor(e/3),y=Math.floor(n/3);let group:StreetLamp|undefined;
    for(let i=x-1;i<=x+1&&!group;i++)for(let j=y-1;j<=y+1&&!group;j++) {
      group=(cells.get(`${mount}:${i},${j}`)??[]).find(p=>Math.hypot(p.e-e,p.n-n)<(p.source===asset.source?0.5:3));
    }
    if(group){group.assetIds.push(asset.id);continue;}
    const entry={id:asset.id,e,n,source:asset.source,mount,assetIds:[asset.id]};lights.push(entry);
    const key=`${mount}:${x},${y}`,bucket=cells.get(key)??[];bucket.push(entry);cells.set(key,bucket);
  }
  return removeLightClusters(lights);
}

/** Hide packed fixture groups and keep the remaining visual lights at least 12 m apart. */
export function removeLightClusters(lights: StreetLamp[]): StreetLamp[] {
  const radius=8, cells=new Map<string,number[]>();
  lights.forEach((l,i)=>{
    const key=`${Math.floor(l.e/radius)},${Math.floor(l.n/radius)}`,bucket=cells.get(key)??[];
    bucket.push(i);cells.set(key,bucket);
  });
  const seen=new Set<number>(),hidden=new Set<number>();
  for(let start=0;start<lights.length;start++) {
    if(seen.has(start))continue;
    const pending=[start],group:number[]=[];seen.add(start);
    while(pending.length) {
      const i=pending.pop()!,l=lights[i],x=Math.floor(l.e/radius),y=Math.floor(l.n/radius);group.push(i);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const j of cells.get(`${x+dx},${y+dy}`)??[]) {
        if(!seen.has(j)&&Math.hypot(lights[j].e-l.e,lights[j].n-l.n)<radius){seen.add(j);pending.push(j);}
      }
    }
    if(group.length>=3)group.forEach(i=>hidden.add(i));
  }
  const gap=12,placed=new Map<string,StreetLamp[]>(),result:StreetLamp[]=[];
  const candidates=lights.filter((_,i)=>!hidden.has(i)).sort((a,b)=>a.id.localeCompare(b.id));
  for(const l of candidates) {
    const x=Math.floor(l.e/gap),y=Math.floor(l.n/gap);let crowded=false;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++) {
      if((placed.get(`${x+dx},${y+dy}`)??[]).some(p=>Math.hypot(p.e-l.e,p.n-l.n)<gap))crowded=true;
    }
    if(crowded)continue;
    result.push(l);const key=`${x},${y}`,bucket=placed.get(key)??[];bucket.push(l);placed.set(key,bucket);
  }
  return result;
}
