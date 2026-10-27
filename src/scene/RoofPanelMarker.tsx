import type { SolarSystemResult } from '../ui/useSolarSystem';
import type { RoofPanel, PanelSettings } from './solarPanel';
export interface SolarSystemHover { result: SolarSystemResult; difference: string }
export function RoofPanelMarker({ id, roof, settings }: {id: number; roof: RoofPanel; settings: PanelSettings}) {
 return <group position={[...roof.en, roof.ahdM + 0.9]} rotation={[0, 0, -settings.azimuth * Math.PI / 180]} userData={{solarPanelId: id}}>
  <group rotation={[-settings.tilt * Math.PI / 180, 0, 0]}>
   <mesh castShadow receiveShadow><boxGeometry args={[1.1, 1.8, 0.08]}/><meshStandardMaterial color="#18385f" metalness={0.4} roughness={0.3}/></mesh>
   {[-0.36, 0, 0.36].map(x => <mesh key={x} position={[x,0,0.046]}><boxGeometry args={[0.015,1.76,0.005]}/><meshStandardMaterial color="#a5d7ed"/></mesh>)}
   {[-0.6,0,0.6].map(y => <mesh key={y} position={[0,y,0.046]}><boxGeometry args={[1.06,0.015,0.005]}/><meshStandardMaterial color="#a5d7ed"/></mesh>)}
  </group>
  <mesh position={[0,0,-0.85]}><boxGeometry args={[3,3,0.04]}/><meshBasicMaterial color="#39cda0" transparent opacity={0.45}/></mesh>
 </group>;
}
