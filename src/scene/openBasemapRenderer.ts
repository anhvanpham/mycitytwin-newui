import { Map as LibreMap, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { ImagePlacement } from './basemap';
setWorkerUrl(workerUrl);

/** Render the open vector basemap once, then release its WebGL context.
 * The sunlight scene samples this canvas on its own georeferenced ground.
 * Shared promises let both comparison views use one render and one download.
 */
const images=new Map<string,Promise<HTMLCanvasElement>>();
export function renderOpenBasemap(placement:ImagePlacement):Promise<HTMLCanvasElement> {
  const key=JSON.stringify(placement);const cached=images.get(key);if(cached)return cached;
  const image=new Promise<HTMLCanvasElement>((resolve,reject)=>{
    const host=document.createElement('div');
    Object.assign(host.style,{position:'fixed',left:'-10000px',top:'0',width:`${placement.widthPx}px`,height:`${placement.heightPx}px`,pointerEvents:'none'});
    host.setAttribute('aria-hidden','true');document.body.append(host);
    let map:LibreMap|null=null,done=false;
    const finish=(error?:Error)=>{
      if(done)return;done=true;clearTimeout(timer);
      if(error){map?.remove();host.remove();reject(error);return;}
      const canvas=document.createElement('canvas'),source=map!.getCanvas();canvas.width=source.width;canvas.height=source.height;
      const context=canvas.getContext('2d');if(!context){map?.remove();host.remove();reject(new Error('No map canvas'));return;}
      context.drawImage(source,0,0);map?.remove();host.remove();resolve(canvas);
    };
    const timer=setTimeout(()=>finish(new Error('Open basemap timed out')),30000);
    try {
      map=new LibreMap({container:host,style:'https://tiles.openfreemap.org/styles/liberty',center:[placement.centre.lon,placement.centre.lat],zoom:placement.zoom,bearing:0,pitch:0,interactive:false,attributionControl:false,renderWorldCopies:false,pixelRatio:2,maxCanvasSize:[4096,4096],fadeDuration:0,canvasContextAttributes:{preserveDrawingBuffer:true,antialias:true}});
      map.on('load',()=>{
        for(const layer of map!.getStyle().layers??[]) {
          // Street names and clickable landmark labels are sized by the scene camera.
          // Baking vector labels into a ground texture would enlarge them at close zoom.
          if(layer.id.includes('building') || layer.type==='symbol')map!.setLayoutProperty(layer.id,'visibility','none');
        }
        // Idle means all requested street tiles and label glyphs are rendered.
        map!.once('idle',()=>finish());map!.triggerRepaint();
      });
      map.on('error',event=>{if(!('sourceId' in event)&&!map?.isStyleLoaded())finish(new Error('Open basemap unavailable'));});
    } catch(error){finish(error instanceof Error?error:new Error('Open basemap unavailable'));}
  });
  images.set(key,image);image.catch(()=>images.delete(key));return image;
}
