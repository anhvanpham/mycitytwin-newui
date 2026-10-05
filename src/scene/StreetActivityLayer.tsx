import { Color } from 'three';
import { Html } from '@react-three/drei';
import { activityColor, sensorPosition, visibleSensors, type ActivityDoc } from '../data/streetActivity';
import { enuToWorld } from './frame';

const haloVertex = `
  varying vec2 haloUv;
  void main() {
    haloUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const haloFragment = `
  uniform vec3 haloColor;
  uniform float strength;
  varying vec2 haloUv;
  void main() {
    float radius = length(haloUv - 0.5) * 2.0;
    float fade = exp(-4.0 * radius * radius) * (1.0 - smoothstep(0.55, 1.0, radius));
    gl_FragColor = vec4(haloColor, fade * strength);
    #include <colorspace_fragment>
  }
`;

/** Soft sensor halos on the ground plane; the selected HTML label stays upright. */
export function StreetActivityLayer({ doc, index, selected, ground, onSelect }:{
  doc: ActivityDoc; index: number; selected: number; ground: number; onSelect: (id: number) => void;
}) {
  const sensors = visibleSensors(doc);
  const maximum = Math.max(1, ...sensors.flatMap(s => s.counts.filter((c): c is number => c !== null)));
  return <group>{sensors.map(s => {
    const [e, n] = sensorPosition(s), count = s.counts[index];
    return <group key={s.id}>
      <mesh position={enuToWorld([e, n, ground + 2])} rotation={[-Math.PI / 2, 0, 0]} renderOrder={30}
        onClick={event => {
          if (!event.uv || event.uv.distanceTo({ x: 0.5, y: 0.5 }) > 0.25) return;
          event.stopPropagation(); onSelect(s.id);
        }}>
        <planeGeometry args={[180, 180]}/>
        <shaderMaterial vertexShader={haloVertex} fragmentShader={haloFragment}
          uniforms={{ haloColor: { value: new Color(activityColor(count, maximum)) }, strength: { value: count === null ? 0.45 : 0.8 } }}
          transparent depthWrite={false} depthTest={false} toneMapped={false}/>
      </mesh>
      <Html center style={{ pointerEvents: "none" }} position={enuToWorld([e, n, ground + 14])} zIndexRange={s.id === selected ? [6, 5] : [4, 2]}>
        <button type="button" className={`activity-pin${s.id === selected ? "" : " activity-pin--hit"}`} style={s.id === selected ? { backgroundColor: activityColor(count, maximum) } : undefined} aria-pressed={s.id === selected} onClick={() => onSelect(s.id)}
          aria-label={`${s.name}: ${count === null ? "forecast unavailable" : `${Math.round(count)} predicted movements per hour`}`} title={`${s.name} · ${s.activity[index]}`}>
          {s.id === selected ? `${s.name} · ${(count === null ? "Unavailable" : Math.round(count).toLocaleString())}` : <span className="visually-hidden">{s.name} · {(count === null ? "Unavailable" : Math.round(count).toLocaleString())}</span>}
        </button>
      </Html>
    </group>;
  })}</group>;
}
