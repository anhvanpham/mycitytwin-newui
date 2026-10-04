/** Refresh public CBD visuals. No keys needed. --from-cache /tmp reuses downloaded inputs. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import proj4 from 'proj4';
import { obstacleIndex, clearRect, rectPoint } from '../src/data/streetGeometry.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cacheArg = process.argv.indexOf('--from-cache');
const cache = cacheArg >= 0 ? process.argv[cacheArg + 1] : null;
const bounds = { south: -37.823, west: 144.948, north: -37.804, east: 144.977 };
const inBounds = (lon, lat) => lon >= bounds.west && lon <= bounds.east && lat >= bounds.south && lat <= bounds.north;
const project = proj4('EPSG:4326', '+proj=utm +zone=55 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
const origin = project.forward([144.9605, -37.8145]);
const en = (lon, lat) => project.forward([lon, lat]).map((v, i) => Math.round((v - origin[i]) * 100) / 100);
async function request(url, options) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(100_000) });
  if (!r.ok) throw new Error(`${r.status}: ${url}`);
  return r.json();
}
const portal = 'https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/';
const where = `latitude>=${bounds.south} AND latitude<=${bounds.north} AND longitude>=${bounds.west} AND longitude<=${bounds.east}`;
const query = `[out:json][timeout:60];(node["highway"="street_lamp"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});node["highway"="crossing"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});way["highway"](${bounds.south},${bounds.west},${bounds.north},${bounds.east}););out body geom;`;
const inputs = cache ? await Promise.all(['cbd-trees-raw.json', 'cbd-lights-raw.json', 'cbd-osm-raw.json'].map(f => readFile(resolve(cache, f), 'utf8').then(JSON.parse))) : await Promise.all([
  request(portal + 'trees-with-species-and-dimensions-urban-forest/exports/json?where=' + encodeURIComponent(where)),
  request(portal + 'feature-lighting-including-light-type-wattage-and-location/exports/json'),
  request('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: query }) }),
]);
const [treeRows, lightRows, osm] = inputs;
const buildings = JSON.parse(await readFile(resolve(root, 'public/data/building-footprints.json'), 'utf8'));
const polygons = buildings.features.flatMap(f => f.geometry.coordinates.map(p => p.map(r => r.map(([lon, lat]) => en(lon, lat)))));
const free = obstacleIndex(polygons);
const allVertices = polygons.flatMap(p => p[0]);
const extent = { minE: Math.min(...allVertices.map(p => p[0])) - 100, maxE: Math.max(...allVertices.map(p => p[0])) + 100, minN: Math.min(...allVertices.map(p => p[1])) - 100, maxN: Math.max(...allVertices.map(p => p[1])) + 100 };
const covered = ([e, n]) => e >= extent.minE && e <= extent.maxE && n >= extent.minN && n <= extent.maxN;
const visible = p => covered(p) && free(p);
const treeIds = new Set();
const trees = treeRows.flatMap(r => {
  const p = r.geolocation ?? r.coordinatelocation;
  if (!p || !inBounds(p.lon, p.lat)) return [];
  const [e,n] = en(p.lon, p.lat); const id = String(r.com_id);
  if (!visible([e,n]) || treeIds.has(id)) return []; treeIds.add(id);
  return [{ id, e, n, species: r.common_name ?? 'Tree', diameterCm: Number(r.diameter_breast_height) || null }];
});
const lights = []; const lampCells = new Map();
function addLamp(id, point, source) {
  if (!visible(point)) return;
  const x = Math.floor(point[0]/3), y = Math.floor(point[1]/3);
  for (let i=x-1;i<=x+1;i++) for (let j=y-1;j<=y+1;j++) {
    if ((lampCells.get(`${i},${j}`)??[]).some(p => Math.hypot(p[0]-point[0],p[1]-point[1]) < 3)) return;
  }
  const key = `${x},${y}`; const list = lampCells.get(key)??[];list.push(point);lampCells.set(key,list);
  lights.push({ id, e: point[0], n: point[1], source });
}
for (const r of lightRows) {
  const p = r.geo_point_2d;
  if (p && inBounds(p.lon,p.lat) && r.lightmounting?.startsWith('Pole:')) addLamp(`council-${r.assetid}`,en(p.lon,p.lat),'council');
}
for (const r of osm.elements) if (r.type==='node' && r.tags?.highway==='street_lamp' && inBounds(r.lon,r.lat)) addLamp(`osm-${r.id}`,en(r.lon,r.lat),'osm');
const classes = new Set(['primary','secondary','tertiary','unclassified','residential','living_street','busway','primary_link','secondary_link','tertiary_link']);
const roads = osm.elements.filter(r => r.type==='way' && classes.has(r.tags?.highway) && r.geometry?.length>1 && !['yes','building_passage'].includes(r.tags.tunnel) && (!r.tags.layer || r.tags.layer==='0') && r.tags.bridge!=='yes');
const paint = [], crossings = []; const roadNodes = new Map();
const roadWidth = r => Math.max(3.2,Math.min(20,parseFloat(r.tags.width) || (Number(r.tags.lanes) || 2)*3.2));
for (const r of roads) {
  const points = r.geometry.map(p => en(p.lon,p.lat)); const width=roadWidth(r);
  r.nodes?.forEach((node,i) => { const list=roadNodes.get(node)??[];list.push({ road:r, points, i });roadNodes.set(node,list); });
  let station=0;
  for (let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i];const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<0.1)continue;
    const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
    // Divider positions inferred only on roads with an explicit lane count.
    const lanes=Number(r.tags.lanes);
    if (Number.isInteger(lanes) && lanes>=2 && lanes<=6 && r.tags['lane_markings']!=='no') {
      for (let start=Math.ceil(station/9)*9;start<station+length;start+=9) {
        const along=start-station+1.5;if(along>length-1.5)continue;
        for(let lane=1;lane<lanes;lane++) {
          const point=rectPoint({e:a[0],n:a[1],angle,length:0,width:0},along,(lane/lanes-0.5)*width);
          const rect={e:point[0],n:point[1],length:3,width:0.18,angle};
          if(covered(point)&&clearRect(rect,free))paint.push(rect);
        }
      }
    }
    station+=length;
  }
}
for (const r of osm.elements) {
  if (r.type!=='node' || r.tags?.highway!=='crossing' || !inBounds(r.lon,r.lat))continue;
  const style=r.tags['crossing:markings'] ?? (r.tags.crossing==='zebra' ? 'zebra' : null);
  // Don't invent paint at unmarked, ambiguous or signal-only crossings.
  if (!['zebra','lines','dashes','lines:paired'].includes(style))continue;
  const match=roadNodes.get(r.id)?.[0];if(!match)continue;
  const a=match.points[Math.max(0,match.i-1)],b=match.points[Math.min(match.points.length-1,match.i+1)];
  const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);const [e,n]=en(r.lon,r.lat);const width=roadWidth(match.road);
  const pieces=[];
  if(style==='zebra') {
    for(let across=-width/2+0.4;across<width/2;across+=1.1) {
      const p=rectPoint({e,n,angle,length:0,width:0},0,across);
      pieces.push({e:p[0],n:p[1],length:3.2,width:0.55,angle});
    }
  } else {
    for(const along of [-1.6,1.6]) {
      if(style==='dashes')for(let across=-width/2+0.25;across<width/2;across+=1.2) {
        const p=rectPoint({e,n,angle,length:0,width:0},along,across);pieces.push({e:p[0],n:p[1],length:0.25,width:0.65,angle});
      } else {
        const p=rectPoint({e,n,angle,length:0,width:0},along,0);pieces.push({e:p[0],n:p[1],length:0.25,width,angle});
      }
    }
  }
  const valid=pieces.filter(p=>covered([p.e,p.n])&&clearRect(p,free));
  if(valid.length) { paint.push(...valid);crossings.push({id:`osm-${r.id}`,e,n,style}); }
}
const roundRects = rows => rows.map(r => Object.fromEntries(Object.entries(r).map(([k,v])=>[k,Math.round(v*1000)/1000])));
const source={ retrievedAt:new Date().toISOString(), bounds, extent, coverage:'CBD and nearby streets within the building extract, with a 100 m margin', trees:'https://data.melbourne.vic.gov.au/explore/dataset/trees-with-species-and-dimensions-urban-forest/', lights:'https://data.melbourne.vic.gov.au/explore/dataset/feature-lighting-including-light-type-wattage-and-location/', osm:'https://www.openstreetmap.org/copyright', licences:'City of Melbourne CC BY; OpenStreetMap contributors ODbL 1.0', notes:'Tree/pole positions are recorded; tree heights are estimated from trunk diameter and pole sizes are illustrative, not surveyed physical dimensions. Automatic lighting follows solar altitude at the selected date and time, not a measured switching schedule. Road widths/lane divider paint are inferred from OSM tags; crossing style is included only where explicitly mapped. Features conflicting with building footprints omitted. Does not model canopy shade, lighting lux, or every city asset.' };
const doc={version:1,source,trees,lights,paint:roundRects(paint),crossings};
await mkdir(resolve(root,'public/data'),{recursive:true});
await writeFile(resolve(root,'public/data/street-details.json'),JSON.stringify(doc));
await writeFile(resolve(root,'src/data/street-details-summary.json'),JSON.stringify({source,trees:trees.length,lights:lights.length,councilLights:lights.filter(l=>l.source==='council').length,crossings:crossings.length,paintPatches:paint.length},null,2)+'\n');
console.log(`${trees.length} trees, ${lights.length} lamps, ${crossings.length} explicitly marked crossings, ${paint.length} paint patches.`);
