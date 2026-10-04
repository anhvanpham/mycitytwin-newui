/** Small geometry helpers shared by the import tool and the renderer. ENU metres. */
export type EN = [number, number];
export type StreetPolygon = EN[][];
export interface PaintRect { e: number; n: number; length: number; width: number; angle: number }

export function inRing([x, y]: EN, ring: EN[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Index polygons in 50 m cells; querying thousands of assets stays cheap. */
export function obstacleIndex(polygons: StreetPolygon[]) {
  const cells = new Map<string, StreetPolygon[]>();
  const cell = (v: number) => Math.floor(v / 50);
  for (const polygon of polygons) {
    const ring = polygon[0]; if (!ring?.length) continue;
    const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
    for (let x = cell(Math.min(...xs)); x <= cell(Math.max(...xs)); x++) {
      for (let y = cell(Math.min(...ys)); y <= cell(Math.max(...ys)); y++) {
        const key = `${x},${y}`; const list = cells.get(key) ?? []; list.push(polygon); cells.set(key, list);
      }
    }
  }
  return (point: EN) => !(cells.get(`${cell(point[0])},${cell(point[1])}`) ?? [])
    .some(p => inRing(point, p[0]) && !p.slice(1).some(hole => inRing(point, hole)));
}

export function rectPoint(rect: PaintRect, along: number, across: number): EN {
  const c = Math.cos(rect.angle), s = Math.sin(rect.angle);
  return [rect.e + along * c - across * s, rect.n + along * s + across * c];
}

/** Conservative clipping: reject an entire small patch if any part enters a footprint. */
export function clearRect(rect: PaintRect, isFree: (p: EN) => boolean): boolean {
  const nx = Math.max(1, Math.ceil(rect.length / 0.75));
  const ny = Math.max(1, Math.ceil(rect.width / 0.75));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
    if (!isFree(rectPoint(rect, rect.length * (i / nx - 0.5), rect.width * (j / ny - 0.5)))) return false;
  }
  return true;
}
