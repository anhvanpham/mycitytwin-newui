/** Refresh public CBD visuals. No keys needed. --from-cache /tmp reuses downloaded inputs. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import proj4 from 'proj4';
import { obstacleIndex, clearRect, rectPoint } from '../src/data/streetGeometry.ts';
import { lightMount, lightLevel, surveyDate, lightingLocations } from '../src/data/lightingImport.ts';
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
const lightingWhere = `in_bbox(geo_point_2d,${bounds.south},${bounds.west},${bounds.north},${bounds.east})`;
const where = `latitude>=${bounds.south} AND latitude<=${bounds.north} AND longitude>=${bounds.west} AND longitude<=${bounds.east}`;
const query = `[out:json][timeout:60];(node["highway"="street_lamp"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});node["highway"="crossing"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});way["highway"](${bounds.south},${bounds.west},${bounds.north},${bounds.east}););out body geom;`;
const inputs = cache ? await Promise.all(['cbd-trees-raw.json', 'cbd-lights-full-raw.json', 'cbd-osm-raw.json', 'cbd-lux-raw.json'].map(f => readFile(resolve(cache, f), 'utf8').then(JSON.parse))) : await Promise.all([
  request(portal + 'trees-with-species-and-dimensions-urban-forest/exports/json?where=' + encodeURIComponent(where)),
  request(portal + 'feature-lighting-including-light-type-wattage-and-location/exports/json?where=' + encodeURIComponent(lightingWhere)),
  request('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: query }) }),
  request(portal + 'street-lights-with-emitted-lux-level-council-owned-lights-only/exports/json?where=' + encodeURIComponent(lightingWhere)),
]);
const [treeRows, lightRows, osm, luxRows] = inputs;
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
// Preserve every source asset, even where a simplified building hides its location.
// Only the visual groups are combined or omitted; no source fixture is discarded.
const lightingAssets = [], assetIds = new Set();
for (const r of lightRows) {
  const p = r.geo_point_2d, id = `council-${r.assetid}`;
  if (!p || !inBounds(p.lon, p.lat) || assetIds.has(id)) continue;
  const [e,n] = en(p.lon,p.lat); assetIds.add(id);
  lightingAssets.push({ id,e,n,source:'council',mount:lightMount(r.lightmounting),mounting:r.lightmounting??null,
    lampType:r.lamptype??null,watts:lightLevel(r.lamprating),description:r.description??null,location:r.locationdescription??null });
}
for (const r of osm.elements) {
  if (r.type!=='node' || r.tags?.highway!=='street_lamp' || !inBounds(r.lon,r.lat)) continue;
  const id=`osm-${r.id}`; if(assetIds.has(id))continue;
  const [e,n]=en(r.lon,r.lat);assetIds.add(id);
  const mounting=r.tags['lamp_mount']??null;
  const mount=mounting==='wall'?'wall':mounting==='suspended'?'suspended':'pole';
  lightingAssets.push({id,e,n,source:'osm',mount,mounting,lampType:r.tags['light:source']??null,watts:null,description:null,location:null});
}
const lights = lightingLocations(lightingAssets, visible);
const lightLevels=[],readingIds=new Set();
for(const r of luxRows) {
  const p=r.geo_point_2d,lux=lightLevel(r.label);
  if(!p||!inBounds(p.lon,p.lat)||lux===null)continue;
  const [e,n]=en(p.lon,p.lat),date=surveyDate(r.xdate);
  // The source identifier repeats between surveys/locations; keep distinct samples.
  const id=`lux-${r.ext_id}-${date??'undated'}-${e}-${n}`;
  if(readingIds.has(id))continue;readingIds.add(id);
  lightLevels.push({id,e,n,lux,surveyDate:date});
}
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
const surveyDates=[...new Set(lightLevels.map(p=>p.surveyDate).filter(Boolean))].sort();
const source={ retrievedAt:new Date().toISOString(), bounds, extent, coverage:'CBD and nearby streets; visual fixtures limited to the building extract and a 100 m margin', trees:'https://data.melbourne.vic.gov.au/explore/dataset/trees-with-species-and-dimensions-urban-forest/', lights:'https://data.melbourne.vic.gov.au/explore/dataset/feature-lighting-including-light-type-wattage-and-location/', lightLevels:'https://data.melbourne.vic.gov.au/explore/dataset/street-lights-with-emitted-lux-level-council-owned-lights-only/', surveyDates, osm:'https://www.openstreetmap.org/copyright', licences:'City of Melbourne CC BY; OpenStreetMap contributors ODbL 1.0', notes:'Tree/fixture positions are recorded; tree heights are estimated from trunk diameter and fixture dimensions are illustrative, not surveyed physical dimensions. Pole, suspended, wall, bridge and low fixtures are distinguished; unknown mountings use ground markers rather than invented poles. All source lighting assets, mounting descriptions, lamp types and available wattages are retained. The dense decorative arrays at Lonsdale/Russell and Russell/Little Bourke intersections, including the two compact Little Bourke gateway arrays beside Russell Street, are omitted from the visual lamp layer. Same-source fixtures within 0.5 m and matching cross-source fixtures within 3 m are combined visually; distinct nearby positions are retained; positions conflicting with building footprints remain in the asset data but are not drawn. Automatic lighting follows solar altitude at the selected date and time, not a measured switching schedule. The separate light-level layer shows historical council lux records at their recorded locations/dates, not lamp positions or current illumination; no interpolation into unsampled streets. Road widths/lane divider paint are inferred from OSM tags; crossing style is included only where explicitly mapped. Does not model canopy shade or every city asset.' };
const doc={version:2,source,trees,lights,lightingAssets,lightLevels,paint:roundRects(paint),crossings};
await mkdir(resolve(root,'public/data'),{recursive:true});
await writeFile(resolve(root,'public/data/street-details.json'),JSON.stringify(doc));
await writeFile(resolve(root,'src/data/street-details-summary.json'),JSON.stringify({source,trees:trees.length,lights:lights.length,councilLights:lights.filter(l=>l.source==='council').length,lightingAssets:lightingAssets.length,councilAssets:lightingAssets.filter(l=>l.source==='council').length,lightLevels:lightLevels.length,lightMounts:Object.fromEntries(['pole','suspended','wall','bridge','low','unknown'].map(m=>[m,lights.filter(l=>l.mount===m).length])),crossings:crossings.length,paintPatches:paint.length},null,2)+'\n');
console.log(`${trees.length} trees, ${lights.length} light locations from ${lightingAssets.length} assets, ${lightLevels.length} historical lux readings, ${crossings.length} crossings, ${paint.length} paint patches.`);
