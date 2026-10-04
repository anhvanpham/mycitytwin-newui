import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Group, Mesh, type Material } from 'three';
import { CBD_OUTER_PLANES, cbdEdgeVisibility } from './cbdBoundary';
import { addCBDFade, cbdFadeUniforms } from './cbdFade';

/** Feather visible scenery only. Outside buildings remain in the original shadow model. */
export function CBDClip({enabled,colour,children}:{enabled:boolean;colour:string;children:ReactNode}) {
  const group=useRef<Group>(null),wrapped=useRef(new WeakSet<Mesh>());
  const fading=useRef(new WeakMap<Material,ReturnType<typeof cbdFadeUniforms>>());
  useFrame(()=>{
    group.current?.traverse(object=>{
      if(!(object instanceof Mesh))return;
      if(!wrapped.current.has(object)) {
        const raycast=object.raycast;
        object.raycast=function(raycaster,hits) {
          const first=hits.length;raycast.call(this,raycaster,hits);
          const material:Material=Array.isArray(this.material)?this.material[0]:this.material;
          for(let i=hits.length-1;i>=first;i--){
            const p=hits[i].point;
            if(material.clippingPlanes && cbdEdgeVisibility([p.x,-p.z])<0.08)hits.splice(i,1);
          }
        };
        wrapped.current.add(object);
      }
      const materials:Material[]=Array.isArray(object.material)?object.material:[object.material];
      for(const material of materials) {
        let uniforms=fading.current.get(material);
        if(!uniforms){
          uniforms=cbdFadeUniforms();fading.current.set(material,uniforms);
          const previous=material.onBeforeCompile,cacheKey=material.customProgramCacheKey.bind(material),key=cacheKey();
          const shared=uniforms;
          material.onBeforeCompile=function(shader,renderer){previous.call(this,shader,renderer);addCBDFade(shader,shared);};
          material.customProgramCacheKey=()=>key+'-cbd-mist-v1';
          material.needsUpdate=true;
        }
        uniforms.cbdFadeOn.value=enabled?1:0;
        uniforms.cbdIsGlow.value=material.blending===AdditiveBlending?1:0;
        // Output-space mixing avoids a seam between tone-mapped city and unlit sky.
        uniforms.cbdFadeColour.value.set(colour).convertLinearToSRGB();
        const planes=enabled?CBD_OUTER_PLANES:null;
        if(material.clippingPlanes!==planes){material.clippingPlanes=planes;material.clipShadows=false;material.needsUpdate=true;}
      }
    });
  });
  return <group ref={group}>{children}</group>;
}
