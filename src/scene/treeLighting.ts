import type { StreetTree } from '../data/streetDetails';

export interface TreeLantern { id: string; e: number; n: number; height: number; offset: number; colour: string }

/** Decorative placements beside recorded trees; these are not mapped lighting assets. */
export function treeLanterns(trees: StreetTree[]): TreeLantern[] {
  const gap=6, cells=new Map<string,TreeLantern[]>(), lanterns:TreeLantern[]=[];
  for(const tree of [...trees].sort((a,b)=>a.id.localeCompare(b.id))) {
    const x=Math.floor(tree.e/gap),y=Math.floor(tree.n/gap);
    let crowded=false;
    for(let i=x-1;i<=x+1;i++)for(let j=y-1;j<=y+1;j++) {
      if((cells.get(`${i},${j}`)??[]).some(l=>Math.hypot(l.e-tree.e,l.n-tree.n)<gap)) crowded=true;
    }
    if(crowded)continue;
    const lantern={id:`decorative-tree-${tree.id}`,e:tree.e,n:tree.n,height:2.1,offset:Math.min(0.65,Math.max(0.1,(tree.diameterCm!==null&&Number.isFinite(tree.diameterCm)&&tree.diameterCm>0?tree.diameterCm:30)/200))+0.1,colour:'#ffe2af'};
    lanterns.push(lantern);const key=`${x},${y}`,bucket=cells.get(key)??[];bucket.push(lantern);cells.set(key,bucket);
  }
  return lanterns;
}
