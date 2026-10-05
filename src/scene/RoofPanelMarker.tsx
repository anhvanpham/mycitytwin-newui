import { useState } from 'react';
import { Html } from '@react-three/drei';
import { Vector3 } from 'three';
import type { SolarSystemResult } from '../ui/useSolarSystem';
import type { RoofPanel, PanelSettings } from './solarPanel';
export interface SolarSystemHover { result: SolarSystemResult; difference: string }
/** Inside WorldFrame: east/north/up. One illustrative 1.1 × 1.8 m panel. */
export function RoofPanelMarker({ id, roof, settings, solarHover }: {id: number; roof: RoofPanel; settings: PanelSettings; solarHover?: SolarSystemHover}) {
 const [hovered, setHovered] = useState(false);
 const [pinned, setPinned] = useState(false);
 return <group position={[...roof.en, roof.ahdM + 0.9]} rotation={[0, 0, -settings.azimuth * Math.PI / 180]} userData={{solarPanelId: id}}
  onPointerOver={solarHover ? e => {e.stopPropagation(); setHovered(true);} : undefined}
  onPointerOut={() => setHovered(false)}
  onClick={solarHover ? e => {e.stopPropagation(); setPinned(true);} : undefined}>
  {solarHover && (hovered || pinned) && <Html position={[0,0,2]} center zIndexRange={[20,10]} calculatePosition={(object, camera, size) => {
   const point = object.getWorldPosition(new Vector3()).project(camera);
   const x = (point.x+1)*size.width/2;
   const y = (1-point.y)*size.height/2;
   return [Math.max(135,Math.min(size.width-135,x)),Math.max(150,Math.min(size.height-150,y < 280 ? y+155 : y-155))];
  }}><div className="solar-hover" role="status" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
   <button aria-label="Close solar system information" onClick={()=>{setHovered(false);setPinned(false);}}>×</button>
   <strong>Solar system · {solarHover.result.count} panels</strong>
   {solarHover.result.available ? <p className="solar-hover__metrics"><b>{solarHover.result.sunHours.toFixed(1)} h</b> sun / panel<br/><b>{solarHover.result.kwh.toFixed(2)} kWh</b> / day</p> : <p>No roof in this view</p>}
   <p className="solar-hover__difference">{solarHover.difference}</p><small>Clear-sky estimate</small>
  </div></Html>}

  <group rotation={[-settings.tilt * Math.PI / 180, 0, 0]}>
   <mesh castShadow receiveShadow><boxGeometry args={[1.1, 1.8, 0.08]}/><meshStandardMaterial color="#18385f" metalness={0.4} roughness={0.3}/></mesh>
   {[-0.36, 0, 0.36].map(x => <mesh key={x} position={[x,0,0.046]}><boxGeometry args={[0.015,1.76,0.005]}/><meshStandardMaterial color="#a5d7ed"/></mesh>)}
   {[-0.6,0,0.6].map(y => <mesh key={y} position={[0,y,0.046]}><boxGeometry args={[1.06,0.015,0.005]}/><meshStandardMaterial color="#a5d7ed"/></mesh>)}
  </group>
  <mesh position={[0,0,-0.85]}><boxGeometry args={[3,3,0.04]}/><meshBasicMaterial color="#39cda0" transparent opacity={0.45}/></mesh>
 </group>;
}
