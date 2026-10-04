import { Plane, Vector3 } from 'three';
import { projectLonLat } from '../data/project';
import { inRing, type EN } from '../data/streetGeometry';
import { LOCAL_ORIGIN_WGS84, enuToWorld } from './frame';
import { mercatorFromLonLat, sceneToLonLat, type ImagePlacement } from './basemap';

// Approximate Hoddle Grid preview: Spencer, Flinders, Spring and La Trobe.
// Corners follow the mapped street junctions; this is not an administrative boundary.
const corners: EN[] = [[144.95143,-37.81317],[144.95507,-37.82108],[144.97490,-37.81528],[144.97108,-37.80771]];
const origin=projectLonLat(LOCAL_ORIGIN_WGS84.lon,LOCAL_ORIGIN_WGS84.lat);
const centre:EN=corners.map(([lon,lat])=>projectLonLat(lon,lat)).reduce<EN>((a,p)=>[a[0]+(p[0]-origin[0])/4,a[1]+(p[1]-origin[1])/4],[0,0]);
// Small margin includes the boundary streets themselves.
export const CBD_RING:EN[]=corners.map(([lon,lat])=>{
  const p=projectLonLat(lon,lat);const e=p[0]-origin[0],n=p[1]-origin[1];
  const length=Math.hypot(e-centre[0],n-centre[1]);
  return [e+(e-centre[0])*35/length,n+(n-centre[1])*35/length];
});
export const insideCBD=(p:EN)=>inRing(p,CBD_RING);
export const CBD_FADE_IN_M=85;
export const CBD_FADE_OUT_M=155;
export const CBD_PLANES=CBD_RING.map((p,i)=>{
  const q=CBD_RING[(i+1)%CBD_RING.length],dx=q[0]-p[0],dy=q[1]-p[1];
  const normal=new Vector3(...enuToWorld([-dy,dx,0])).normalize();
  return new Plane().setFromNormalAndCoplanarPoint(normal,new Vector3(...enuToWorld([p[0],p[1],0])));
});
// The final clip lies beyond the mist, where colour has already fully disappeared.
export const CBD_OUTER_PLANES=CBD_PLANES.map(p=>{const plane=p.clone();plane.constant+=CBD_FADE_OUT_M;return plane;});
export function cbdEdgeVisibility([e,n]:EN) {
  const distance=Math.min(...CBD_PLANES.map(p=>p.normal.x*e-p.normal.z*n+p.constant));
  const t=Math.min(1,Math.max(0,(distance+CBD_FADE_OUT_M)/(CBD_FADE_IN_M+CBD_FADE_OUT_M)));
  return t*t*(3-2*t);
}
export function cbdGroundPlacement() {
  const mercator=CBD_RING.map(p=>mercatorFromLonLat(...sceneToLonLat(...p)));
  const xs=mercator.map(p=>p[0]),ys=mercator.map(p=>p[1]);
  const mx=(Math.min(...xs)+Math.max(...xs))/2,my=(Math.min(...ys)+Math.max(...ys))/2;
  const lon=mx/6378137*180/Math.PI,lat=(2*Math.atan(Math.exp(my/6378137))-Math.PI/2)*180/Math.PI;
  const [e,n]=projectLonLat(lon,lat);
  const mercatorSpan=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))*1.06+CBD_FADE_OUT_M*2/Math.cos(lat*Math.PI/180);
  const placement:ImagePlacement={centre:{lon,lat},zoom:Math.log2(2*Math.PI*6378137*2048/(512*mercatorSpan)),widthPx:2048,heightPx:2048};
  return {centreE:e-origin[0],centreN:n-origin[1],size:mercatorSpan*Math.cos(lat*Math.PI/180)*1.02,placement};
}
