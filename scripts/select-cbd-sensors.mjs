import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

// Use the actual map's projected polygon and margin, never a second definition of CBD.
const [inventoryPath, outputPath] = process.argv.slice(2);
if (!inventoryPath || !outputPath) throw new Error('Usage: node scripts/select-cbd-sensors.mjs inventory.json selection.json');
const inventory = JSON.parse(await readFile(resolve(inventoryPath), 'utf8'));
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { insideCBD, CBD_RING } = await server.ssrLoadModule('/src/scene/cbdBoundary.ts');
  const { projectLonLat } = await server.ssrLoadModule('/src/data/project.ts');
  const { LOCAL_ORIGIN_WGS84 } = await server.ssrLoadModule('/src/scene/frame.ts');
  const [oe, on] = projectLonLat(LOCAL_ORIGIN_WGS84.lon, LOCAL_ORIGIN_WGS84.lat);
  const sensors = inventory.reportingSensors.filter(s => {
    if (s.status !== 'A' || s.type !== 'Outdoor') return false;
    const [e, n] = projectLonLat(s.lon, s.lat);
    return insideCBD([e - oe, n - on]);
  });
  const selectedIds = sensors.map(s => s.id);
  const excluded = inventory.reportingSensors.filter(s => !selectedIds.includes(s.id)).map(s => ({ id: s.id, name: s.name, reason: 'Outside existing CBD boundary or not active outdoors' }));
  const selection = { fetchedAt: inventory.fetchedAt, reportingCount: inventory.reportingCount,
    boundary: 'My City Twin Hoddle Grid preview with the original 35 m corner margin',
    boundaryEN: CBD_RING, source: inventory.source, sensors, selectedIds, excluded };
  await writeFile(resolve(outputPath), JSON.stringify(selection, null, 2));
  console.log(JSON.stringify({ reporting: inventory.reportingCount, insideCBD: sensors.length, excluded: excluded.length, ids: selectedIds }));
} finally {
  await server.close();
}
