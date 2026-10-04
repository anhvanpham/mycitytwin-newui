import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, DataTexture, Float32BufferAttribute, LinearFilter, PointsMaterial, RGBAFormat } from 'three';
import type { LightLevel } from '../data/streetDetails';
import { cbdEdgeVisibility } from './cbdBoundary';

const NO_RAYCAST = () => null;

/** Recorded sample dots, not interpolated lighting or extra lamp positions. */
export function HistoricalLightLevels({readings,ground}:{readings:LightLevel[];ground:number}) {
  const geometry=useMemo(()=>{
    const positions:number[]=[],colours:number[]=[],visibility:number[]=[];
    const dark=new Color('#8174c4'),middle=new Color('#e5a1ce'),bright=new Color('#ffe3a1'),colour=new Color();
    for(const p of readings) {
      const fade=cbdEdgeVisibility([p.e,p.n]);if(fade<=0)continue;
      positions.push(p.e,p.n,ground+0.18);visibility.push(fade);
      const value=Math.min(1,Math.log1p(p.lux)/Math.log(101));
      if(value<0.5)colour.copy(dark).lerp(middle,value*2);
      else colour.copy(middle).lerp(bright,(value-0.5)*2);
      colours.push(colour.r,colour.g,colour.b);
    }
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));
    g.setAttribute('color',new Float32BufferAttribute(colours,3));
    g.setAttribute('lightingVisibility',new Float32BufferAttribute(visibility,1));return g;
  },[readings,ground]);
  const material=useMemo(()=>{
    const size=32,pixels=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const i=(y*size+x)*4,radius=Math.hypot((x+0.5)/size*2-1,(y+0.5)/size*2-1);
      pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(255*Math.pow(Math.max(0,1-radius),0.65));
    }
    const texture=new DataTexture(pixels,size,size,RGBAFormat);texture.magFilter=LinearFilter;texture.minFilter=LinearFilter;texture.needsUpdate=true;
    const m=new PointsMaterial({map:texture,size:3.4,vertexColors:true,transparent:true,opacity:0.85,depthWrite:false,toneMapped:false});
    m.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float lightingVisibility; varying float vLightingVisibility;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvLightingVisibility = lightingVisibility;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vLightingVisibility;')
        .replace('#include <map_particle_fragment>','#include <map_particle_fragment>\ndiffuseColor.a *= vLightingVisibility;');
    };
    m.customProgramCacheKey=()=> 'historical-light-levels-v1';return m;
  },[]);
  useEffect(()=>()=>{geometry.dispose();},[geometry]);
  useEffect(()=>()=>{material.map?.dispose();material.dispose();},[material]);
  return <points geometry={geometry} material={material} raycast={NO_RAYCAST} frustumCulled={false} renderOrder={2}/>;
}
