import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { ImagePlacement } from './basemap';
export function useOpenBasemapTexture(placement:ImagePlacement,enabled:boolean) {
  const anisotropy=useThree(s=>s.gl.capabilities.getMaxAnisotropy());
  const [loaded,setLoaded]=useState<{key:string;canvas:HTMLCanvasElement}|null>(null);
  const key=JSON.stringify(placement);
  useEffect(()=>{
    if(!enabled)return;let live=true;
    import('./openBasemapRenderer').then(module=>module.renderOpenBasemap(placement)).then(canvas=>{
      if(live)setLoaded({key,canvas});
    }).catch(error=>{if(live)console.warn('Open street basemap unavailable; sunlight still works.',error);});
    return ()=>{live=false;};
  },[placement,enabled,key]);
  const texture=useMemo(()=>{
    if(!enabled || loaded?.key!==key)return null;
    const result=new CanvasTexture(loaded.canvas);result.colorSpace=SRGBColorSpace;result.anisotropy=anisotropy;return result;
  },[loaded,key,enabled,anisotropy]);
  useEffect(()=>()=>texture?.dispose(),[texture]);
  return texture;
}
