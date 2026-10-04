import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending, BoxGeometry, BufferGeometry, CircleGeometry, Color, CylinderGeometry,
  DataTexture, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh,
  LinearFilter, Matrix4, Quaternion, RGBAFormat, SphereGeometry, Vector3,
} from 'three';
import type { StreetDetailsDoc, StreetLayers, StreetLamp } from '../data/streetDetails';
import { rectPoint } from '../data/streetGeometry';
import { cbdEdgeVisibility } from './cbdBoundary';
import { treeDimensions, streetlightPower, fixtureHeight } from './streetAppearance';
import { HistoricalLightLevels } from './HistoricalLightLevels';
import { treeLanterns } from './treeLighting';
import type { TreeLantern } from './treeLighting';

type Instance = { position: [number, number, number]; scale: [number, number, number]; colour?: string; angle?: number };
type Shape = 'cylinder' | 'crown' | 'box' | 'bulb' | 'pool' | 'lantern' | 'halo' | 'treePool';
const NO_RAYCAST = () => null;
const ARM = 1.35;
const LAMP_ANGLE = Math.PI / 10;
const lampPoint=(l:StreetLamp,ground:number):[number,number,number]=>[
  l.e+(l.mount==='pole'?ARM*Math.cos(LAMP_ANGLE):0),
  l.n+(l.mount==='pole'?ARM*Math.sin(LAMP_ANGLE):0),
  ground+fixtureHeight(l.mount)-(l.mount==='pole'?0.31:0),
];

function lightPoolTexture() {
  const size=64, pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const i=(y*size+x)*4, radius=Math.hypot((x+0.5)/size*2-1,(y+0.5)/size*2-1);
    pixels[i]=255; pixels[i+1]=207; pixels[i+2]=133;
    pixels[i+3]=Math.round(255*Math.pow(Math.max(0,1-radius),2));
  }
  const texture=new DataTexture(pixels,size,size,RGBAFormat);
  texture.magFilter=LinearFilter;texture.minFilter=LinearFilter;texture.needsUpdate=true;
  return texture;
}

/** Shared geometry and instancing keep thousands of trees/poles affordable. All coordinates are ENU. */
function Instances({instances,shape,colour,power=0}:{instances:Instance[];shape:Shape;colour:string;power?:number}) {
  const mesh=useRef<InstancedMesh>(null);
  const geometry=useMemo(()=>{
    if(shape==='cylinder')return new CylinderGeometry(1,1,1,6).rotateX(Math.PI/2);
    if(shape==='crown')return new IcosahedronGeometry(1,1);
    if(shape==='box')return new BoxGeometry(1,1,1);
    if(['bulb','lantern','halo'].includes(shape))return new SphereGeometry(1,8,6);
    return new CircleGeometry(1,24);
  },[shape]);
  const pool=useMemo(()=>shape==='pool'||shape==='treePool'?lightPoolTexture():null,[shape]);
  useEffect(()=>{
    const matrix=new Matrix4(),position=new Vector3(),scale=new Vector3(),rotation=new Quaternion(),axis=new Vector3(0,0,1),tint=new Color();
    instances.forEach((p,i)=>{
      matrix.compose(position.fromArray(p.position),rotation.setFromAxisAngle(axis,p.angle??0),scale.fromArray(p.scale));
      mesh.current?.setMatrixAt(i,matrix);
      if(p.colour)mesh.current?.setColorAt(i,tint.set(p.colour));
    });
    if(mesh.current){mesh.current.instanceMatrix.needsUpdate=true;if(mesh.current.instanceColor)mesh.current.instanceColor.needsUpdate=true;}
  },[instances]);
  useEffect(()=>()=>{geometry.dispose();pool?.dispose();},[geometry,pool]);
  return <instancedMesh ref={mesh} args={[geometry,undefined,instances.length]} raycast={NO_RAYCAST} frustumCulled={false} receiveShadow={!['pool','treePool','bulb','lantern','halo'].includes(shape)}>
    {shape==='treePool' ? <meshBasicMaterial map={pool} transparent opacity={power*0.48} blending={AdditiveBlending} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-8}/> :
      shape==='halo' ? <meshBasicMaterial color={colour} transparent opacity={power*0.16} depthWrite={false} toneMapped={false}/> :
      shape==='lantern' ? <meshStandardMaterial color={colour} emissive="#ffe2af" emissiveIntensity={power*5} toneMapped={false} roughness={0.3}/> :
      shape==='pool' ? <meshBasicMaterial map={pool} transparent opacity={power*0.72} blending={AdditiveBlending} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-8}/> :
      shape==='bulb' ? <meshStandardMaterial color={colour} emissive="#ffd899" emissiveIntensity={power*4} toneMapped={false} roughness={0.4}/> :
      <meshStandardMaterial color={colour} roughness={0.95} emissive={shape==='crown'?'#a0bea9':'#000000'} emissiveIntensity={shape==='crown'?power*0.24:0}/>}
  </instancedMesh>;
}

/** Four mapped fixtures and two tree lanterns share the nearby-light budget. */
function NearbyLights({lights,lanterns,ground,power}:{lights:StreetLamp[];lanterns:TreeLantern[];ground:number;power:number}) {
  const camera=useThree(s=>s.camera),controls=useThree(s=>s.controls) as {target?:Vector3}|null;
  const [near,setNear]=useState<StreetLamp[]>([]);
  const [treeNear,setTreeNear]=useState<TreeLantern[]>([]);
  const previous=useRef({e:Infinity,n:Infinity,elapsed:0});
  useEffect(()=>{ previous.current.e=Infinity;previous.current.n=Infinity; },[lights,lanterns]);
  useFrame((_,delta)=>{
    previous.current.elapsed+=delta;
    if(power===0||previous.current.elapsed<0.5)return;
    const target=controls?.target??camera.position,e=target.x,n=-target.z;
    if(Math.hypot(e-previous.current.e,n-previous.current.n)<20)return;
    previous.current={e,n,elapsed:0};
    setNear(lights.map(l=>({l,d:Math.hypot(l.e-e,l.n-n)})).filter(p=>p.d<150).sort((a,b)=>a.d-b.d).slice(0,4).map(p=>p.l));
    setTreeNear(lanterns.map(l=>({l,d:Math.hypot(l.e-e,l.n-n)})).filter(p=>p.d<100).sort((a,b)=>a.d-b.d).slice(0,2).map(p=>p.l));
  });
  return <group>{near.map(l=><pointLight key={l.id} position={lampPoint(l,ground)} color="#ffd7a0" intensity={power*(l.mount==='pole'||l.mount==='suspended'?220:70)} distance={32} decay={2}/>)}{lanterns.length>0&&treeNear.map(l=><pointLight key={l.id} position={[l.e+l.offset,l.n,ground+l.height]} color={l.colour} intensity={power*65} distance={18} decay={2}/>)}</group>;
}

/** Trees and lamps add visual context; building-only sunlight calculations stay unchanged. */
export function StreetDetails({doc,layers,ground,sunAltitudeDeg}:{doc:StreetDetailsDoc|null;layers:StreetLayers;ground:number;sunAltitudeDeg:number}) {
  const paintGroup=useRef<Group>(null);
  const camera=useThree(s=>s.camera),controls=useThree(s=>s.controls) as {target?:Vector3}|null;
  const trees=useMemo(()=>doc?.trees.filter(p=>cbdEdgeVisibility([p.e,p.n])>0)??[],[doc]);
  const lights=useMemo(()=>doc?.lights.filter(p=>cbdEdgeVisibility([p.e,p.n])>0)??[],[doc]);
  const power=streetlightPower(sunAltitudeDeg);
  const lanterns=useMemo(()=>layers.trees!==false?treeLanterns(trees):[],[trees,layers.trees]);
  const lanternParts=useMemo(()=>({
    bulbs:lanterns.map(l=>({position:[l.e+l.offset,l.n,ground+l.height] as [number,number,number],scale:[0.16,0.16,0.22] as [number,number,number]})),
    halos:lanterns.map(l=>({position:[l.e+l.offset,l.n,ground+l.height] as [number,number,number],scale:[0.55,0.55,0.6] as [number,number,number]})),
    pools:lanterns.map(l=>({position:[l.e+l.offset,l.n,ground+0.13] as [number,number,number],scale:[6,6,1] as [number,number,number]})),
  }),[lanterns,ground]);
  const treeParts=useMemo(()=>{
    const trunks:Instance[]=[],crowns:Instance[]=[];
    trees.forEach((p,i)=>{
      const size=treeDimensions(p.diameterCm,p.species),stem=size.heightM-size.crownHeightM*0.5;
      trunks.push({position:[p.e,p.n,ground+stem/2],scale:[size.trunkRadiusM,size.trunkRadiusM,stem]});
      crowns.push({position:[p.e,p.n,ground+size.heightM-size.crownHeightM/2],scale:[size.crownRadiusM,size.crownRadiusM*0.9,size.crownHeightM/2],colour:['#afd5bd','#a0ccb8','#bfdcc5','#9ecabc'][i%4]});
    });return {trunks,crowns};
  },[trees,ground]);
  const lampParts=useMemo(()=>{
    const poles:Instance[]=[],arms:Instance[]=[],heads:Instance[]=[],bulbs:Instance[]=[],pools:Instance[]=[];
    const cells=new Map<string,StreetLamp[]>();
    for(const l of lights){const key=`${Math.floor(l.e/8)},${Math.floor(l.n/8)}`,bucket=cells.get(key)??[];bucket.push(l);cells.set(key,bucket);}
    for(const l of lights){
      const height=fixtureHeight(l.mount),position=lampPoint(l,ground),[e,n]=position;
      if(l.mount==='pole') {
        poles.push({position:[l.e,l.n,ground+height/2],scale:[0.11,0.11,height]});
        arms.push({position:[(l.e+e)/2,(l.n+n)/2,ground+height-0.15],scale:[ARM+0.15,0.14,0.14],angle:LAMP_ANGLE});
      }
      if(l.mount!=='unknown')heads.push({position:[e,n,position[2]+0.16],scale:[0.9,0.45,0.24],angle:LAMP_ANGLE});
      bulbs.push({position,scale:[0.35,0.2,0.13]});
      const radius=l.mount==='pole'||l.mount==='suspended'?10:4;
      const x=Math.floor(l.e/8),y=Math.floor(l.n/8);let neighbours=0;
      for(let i=x-1;i<=x+1;i++)for(let j=y-1;j<=y+1;j++)for(const other of cells.get(`${i},${j}`)??[])if(Math.hypot(other.e-l.e,other.n-l.n)<8)neighbours++;
      const weight=1/Math.sqrt(Math.max(1,neighbours));
      pools.push({position:[e,n,ground+0.12],scale:[radius,radius,1],colour:'#'+new Color().setRGB(weight,weight,weight).getHexString()});
    }return {poles,arms,heads,bulbs,pools};
  },[lights,ground]);
  const paint=useMemo(()=>{
    const positions:number[]=[];
    for(const p of doc?.paint??[]) {
      if(cbdEdgeVisibility([p.e,p.n])<=0)continue;
      const corners=[rectPoint(p,-p.length/2,-p.width/2),rectPoint(p,p.length/2,-p.width/2),rectPoint(p,p.length/2,p.width/2),rectPoint(p,-p.length/2,p.width/2)];
      for(const i of [0,1,2,0,2,3])positions.push(...corners[i],ground+0.08);
    }
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
  },[doc,ground]);
  useEffect(()=>()=>paint.dispose(),[paint]);
  useFrame(()=>{
    const target=controls?.target;if(!target)return;
    if(paintGroup.current)paintGroup.current.visible=layers.roadMarkings!==false&&camera.position.distanceTo(target)<1800;
  });
  return <group>
    {layers.lightLevels===true&&doc&&<HistoricalLightLevels readings={doc.lightLevels} ground={ground}/>}
    {layers.trees!==false&&<group><Instances instances={treeParts.trunks} shape="cylinder" colour="#8b7863"/><Instances instances={treeParts.crowns} shape="crown" colour="#ffffff" power={layers.streetlights!==false?power:0}/></group>}
    {layers.streetlights!==false&&<group>
      <Instances instances={lampParts.poles} shape="cylinder" colour="#969bb0"/>
      <Instances instances={lampParts.arms} shape="box" colour="#969bb0"/>
      <Instances instances={lampParts.heads} shape="box" colour="#858ca3"/>
      <Instances instances={lampParts.bulbs} shape="bulb" colour={power>0?'#ffe4af':'#cad2d4'} power={power}/>
      {power>0&&<><Instances instances={lampParts.pools} shape="pool" colour="#fff" power={power}/><NearbyLights lights={lights} lanterns={lanterns} ground={ground} power={power}/></>}
    </group>}
    {layers.streetlights!==false&&layers.trees!==false&&power>0&&<group>
      <Instances instances={lanternParts.pools} shape="treePool" colour="#ffffff" power={power}/>
      <Instances instances={lanternParts.bulbs} shape="lantern" colour="#ffe2af" power={power}/>
      <Instances instances={lanternParts.halos} shape="halo" colour="#ffe2af" power={power}/>
    </group>}
    <group ref={paintGroup} visible={false}><mesh geometry={paint} receiveShadow raycast={NO_RAYCAST}><meshStandardMaterial color="#ffffff" roughness={1} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-7}/></mesh></group>
  </group>;
}

/** Sparse decorative street glows for the landing city, visible only after dusk. */
export function LandingNightLights({doc,ground,sunAltitudeDeg}:{doc:StreetDetailsDoc|null;ground:number;sunAltitudeDeg:number}) {
  const power=streetlightPower(sunAltitudeDeg);
  const parts=useMemo(()=>{
    const lanterns=treeLanterns(doc?.trees.filter(t=>cbdEdgeVisibility([t.e,t.n])>0)??[],45);
    return {
      pools:lanterns.map(l=>({position:[l.e,l.n,ground+0.13] as [number,number,number],scale:[14,14,1] as [number,number,number]})),
      bulbs:lanterns.map(l=>({position:[l.e,l.n,ground+0.4] as [number,number,number],scale:[0.5,0.5,0.5] as [number,number,number]})),
    };
  },[doc,ground]);
  if(power===0)return null;
  return <group>
    <Instances instances={parts.pools} shape="treePool" colour="#ffffff" power={power*0.85}/>
    <Instances instances={parts.bulbs} shape="lantern" colour="#ffe2af" power={power}/>
  </group>;
}
