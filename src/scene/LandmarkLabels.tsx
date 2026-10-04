import { useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { LANDMARKS, type Landmark } from '../data/landmarks';
import { enuToWorld } from './frame';
import { insideCBD } from './cbdBoundary';
const current=LANDMARKS.filter(l=>l.siteStatus==='current'&&insideCBD(l.anchorEN));
export function LandmarkLabels({ground,onSelect}:{ground:number;onSelect?:(l:Landmark)=>void}) {
  const camera=useThree(s=>s.camera),controls=useThree(s=>s.controls) as {target?:{x:number;y:number;z:number}}|null;
  const [labels,setLabels]=useState<Landmark[]>([]),last=useRef([Infinity,Infinity,Infinity]);
  useFrame(()=>{
    const target=controls?.target;if(!target)return;const d=Math.hypot(camera.position.x-target.x,camera.position.y-target.y,camera.position.z-target.z);
    const old=last.current;if(Math.hypot(target.x-old[0],target.z-old[1])<60&&Math.abs(d-old[2])<150)return;
    last.current=[target.x,target.z,d];
    const radius=Math.min(650,Math.max(150,d*0.4));
    const nearby=current.filter(l=>Math.hypot(l.anchorEN[0]-target.x,l.anchorEN[1]+target.z)<radius).sort((a,b)=>Math.hypot(a.anchorEN[0]-target.x,a.anchorEN[1]+target.z)-Math.hypot(b.anchorEN[0]-target.x,b.anchorEN[1]+target.z));
    const selected:Landmark[]=[],spacing=Math.min(180,Math.max(45,d*0.07));
    for(const l of nearby){if(selected.every(other=>Math.hypot(other.anchorEN[0]-l.anchorEN[0],other.anchorEN[1]-l.anchorEN[1])>spacing))selected.push(l);if(selected.length===6)break;}
    setLabels(selected);
  });
  return <group>{labels.map(l=><Html key={l.id} center position={enuToWorld([l.anchorEN[0],l.anchorEN[1],ground+2])} zIndexRange={[4,1]} style={{pointerEvents:onSelect?'auto':'none'}}><button type="button" className="cbd-landmark" disabled={!onSelect} onClick={()=>onSelect?.(l)}>{l.name}</button></Html>)}</group>;
}
