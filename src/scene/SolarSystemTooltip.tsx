import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Raycaster, Vector2, type Object3D } from 'three';
import type { SolarSystemHover } from './RoofPanelMarker';
/** One DOM card per comparison canvas. Native raycasting avoids mesh enter/out churn. */
export function SolarSystemTooltip({panels, blockers, info}: {panels: RefObject<Object3D | null>; blockers: RefObject<Object3D | null>[]; info: SolarSystemHover}) {
 const {gl, camera} = useThree();
 const tooltipPortal = useMemo(() => ({current: document.body}), []);
 const [position, setPosition] = useState<{x:number; y:number} | null>(null);
 const latest = useRef({camera, blockers});
 const dismissed = useRef(false);
 useEffect(()=>{latest.current={camera,blockers};});
 useEffect(()=>{
  const canvas=gl.domElement;
  const ray=new Raycaster(); const point=new Vector2();
  const pick=(event: PointerEvent | MouseEvent) => {
   const bounds=canvas.getBoundingClientRect();
   point.set((event.clientX-bounds.left)/bounds.width*2-1, -(event.clientY-bounds.top)/bounds.height*2+1);
   ray.setFromCamera(point,latest.current.camera);
   if(!panels.current) return null;
   const panelHit=ray.intersectObject(panels.current,true)[0];
   if(!panelHit) return null;
   const targets=latest.current.blockers.map(b=>b.current).filter((o): o is Object3D=>o!==null);
   const obstruction=ray.intersectObjects(targets,true)[0];
   if(obstruction && obstruction.distance < panelHit.distance) return null;
   let node: Object3D | null=panelHit.object;
   while(node){if(node.userData.solarPanelId) return bounds;node=node.parent;}
   return null;
  };
  const move=(event: PointerEvent)=>{
   const bounds=pick(event);
   if(bounds){if(!dismissed.current) setPosition(current=>current??{x:Math.max(8,Math.min(bounds.width-264,event.clientX-bounds.left+20)),y:Math.max(8,Math.min(bounds.height-230,event.clientY-bounds.top+20))});}
   else {dismissed.current=false;}
  };
  const click=(event: MouseEvent)=>{const bounds=pick(event);if(bounds){dismissed.current=false;setPosition(current=>current??{x:Math.max(8,Math.min(bounds.width-264,event.clientX-bounds.left+20)),y:Math.max(8,Math.min(bounds.height-230,event.clientY-bounds.top+20))});}};
  canvas.addEventListener('pointermove',move);canvas.addEventListener('click',click);
  return ()=>{canvas.removeEventListener('pointermove',move);canvas.removeEventListener('click',click);};
 },[gl,panels]);
 return <Html portal={tooltipPortal} calculatePosition={()=>{const bounds=gl.domElement.getBoundingClientRect();return [bounds.left+window.scrollX,bounds.top+window.scrollY];}} zIndexRange={[10000,10000]} style={{pointerEvents:'none'}}>
  {position && <div className="solar-hover" role="status" style={{position:'absolute',left:position.x,top:position.y,pointerEvents:'auto'}}
   onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
   <button aria-label="Close solar system information" onClick={()=>{dismissed.current=true;setPosition(null);}}>×</button>
   <strong>Solar system · {info.result.count} panels</strong>
   {info.result.available ? <p><b>{info.result.sunHours.toFixed(1)} h</b> sun / panel<br/><b>{info.result.kwh.toFixed(2)} kWh</b> / day</p> : <p>No roof in this view</p>}
   <p className="solar-hover__difference">{info.difference}</p><small>Clear-sky estimate</small>
  </div>}
 </Html>;
}
