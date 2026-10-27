import { Plane, Vector3 } from 'three';
import { projectLonLat } from '../data/project';
import { inRing, type EN } from '../data/streetGeometry';
import { LOCAL_ORIGIN_WGS84, enuToWorld } from './frame';
import { mercatorFromLonLat, sceneToLonLat, type ImagePlacement } from './basemap';
import { HODDLE_GRID_RING } from '../data/hoddleGrid';

// One shared Hoddle Grid outline for the landing page, city scenes and timeline.
const origin=projectLonLat(LOCAL_ORIGIN_WGS84.lon,LOCAL_ORIGIN_WGS84.lat);
export const CBD_RING:EN[]=HODDLE_GRID_RING.slice(0,-1).map(([lon,lat])=>{
  const [e,n]=projectLonLat(lon,lat);return [e-origin[0],n-origin[1]];
});
export const CBD_EXTENT={
  minE:Math.min(...CBD_RING.map(p=>p[0])), maxE:Math.max(...CBD_RING.map(p=>p[0])),
  minN:Math.min(...CBD_RING.map(p=>p[1])), maxN:Math.max(...CBD_RING.map(p=>p[1])),
};
export const insideCBD=(p:EN)=>inRing(p,CBD_RING);
export const CBD_FADE_IN_M=0;
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
