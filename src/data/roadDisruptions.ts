export type RoadFeedKind = 'planned' | 'unplanned';
export type Position = [number, number];
export interface RoadRecurrence {
  startDay: string; daysDuration: number; startTime: string; duration: string; allDay: boolean;
}
export interface RoadNotice {
  id: string; kind: RoadFeedKind; road: string; event: string; impact: string; direction: string;
  description: string; lanes: string; paths: Position[][]; start: string | null; end: string | null;
  recurrences: RoadRecurrence[]; scheduleUncertain: boolean; updatedAt: string | null;
  nextUpdateAt: string | null; sourceUrl: string;
}
export interface RoadFeed {
  kind: RoadFeedKind; status: 'ready' | 'unconfigured' | 'unavailable'; checkedAt: string | null;
  refreshSeconds: number; sourceUrl: string; notices: RoadNotice[]; unlocatedCount: number;
}
export interface RoadDoc { schemaVersion: 1; feeds: RoadFeed[] }
export const ROAD_SOURCES = {
  planned: 'https://opendata.transport.vic.gov.au/dataset/planned-disruptions-road',
  unplanned: 'https://opendata.transport.vic.gov.au/dataset/unplanned-disruptions-road',
};
export const TRAFFIC_URL = 'https://traffic.transport.vic.gov.au/';
export const REFRESH_SECONDS = { planned: 1800, unplanned: 60 };
const zone = 'Australia/Melbourne';
const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
function wallParts(ms: number): number[] {
  const p = Object.fromEntries(partsFormatter.formatToParts(ms).map(v => [v.type, v.value]));
  return [p.year, p.month, p.day, p.hour, p.minute, p.second].map(Number);
}
function wallInstant(parts: number[]): number | null {
  const target = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
  const calendar = new Date(target);
  if ([calendar.getUTCFullYear(), calendar.getUTCMonth() + 1, calendar.getUTCDate(), calendar.getUTCHours(), calendar.getUTCMinutes(), calendar.getUTCSeconds()].some((v, n) => v !== parts[n])) return null;
  let ms = target;
  for (let n = 0; n < 4; n++) {
    const p = wallParts(ms);
    const shown = Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5]);
    if (shown === target) return ms;
    ms += target - shown;
  }
  // A nonexistent daylight-saving wall time must not silently shift to another hour.
  return null;
}
/** Offset-free source timestamps are Victorian local time, never the server timezone. */
export function melbourneInstant(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    const ms = Date.parse(value); return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(value);
  if (!match) return null;
  const ms = wallInstant(match.slice(1).map(v => Number(v ?? 0)));
  return ms === null ? null : new Date(ms).toISOString();
}
type Obj = Record<string, unknown>;
export const object = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const string = (v: unknown) => typeof v === 'string' ? v.trim().slice(0, 6000) : '';
function geometryPaths(value: unknown): Position[][] {
  const g = object(value);
  if (g.type === 'GeometryCollection' || Array.isArray(g.geometries)) return (Array.isArray(g.geometries) ? g.geometries : []).flatMap(geometryPaths);
  const point = (v: unknown): v is Position => Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number' && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90;
  if (g.type === 'Point' && point(g.coordinates)) return [[g.coordinates.slice(0, 2) as Position]];
  if (g.type === 'LineString' && Array.isArray(g.coordinates) && g.coordinates.length > 0 && g.coordinates.every(point)) return [g.coordinates.map(v => v.slice(0, 2) as Position)];
  return [];
}
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function durationMs(s: string): number | null {
  const m = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(s);
  if (!m || !m.slice(1).some(Boolean)) return null;
  const ms = (Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) * 1000;
  return ms > 0 && ms <= 86400000 ? ms : null;
}
function validRecurrence(value: unknown): value is RoadRecurrence {
  const r = object(value);
  return weekdays.includes(string(r.startDay)) && Number.isInteger(r.daysDuration) && Number(r.daysDuration) >= 1 && Number(r.daysDuration) <= 7 &&
    typeof r.allDay === 'boolean' && (r.allDay || (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(string(r.startTime)) && durationMs(string(r.duration)) !== null));
}
export function normalizeRoadFeatures(features: unknown[], kind: RoadFeedKind): { notices: RoadNotice[]; unlocatedCount: number } {
  const notices = new Map<string, RoadNotice>(); let unlocatedCount = 0;
  for (const raw of features) {
    const f = object(raw), p = object(f.properties), source = object(p.source), impact = object(p.impact), duration = object(p.duration), reference = object(p.reference);
    if ([p.status, p.eventLocationStatus].some(v => /^(inactive|reopened|closed|completed|cancelled)$/i.test(string(v)))) continue;
    if (/tow\s*allocation/i.test(string(source.sourceName))) continue;
    // Only active unexpected incidents describe conditions now; pending notices are not active closures.
    if (kind === 'unplanned' && ([p.status, p.eventLocationStatus].some(v => /^pending$/i.test(string(v))) || ![p.status, p.eventLocationStatus].some(v => /^active$/i.test(string(v))))) continue;
    const paths = geometryPaths(f.geometry ?? { geometries: f.geometries });
    if (!paths.length) { unlocatedCount++; continue; }
    const sourceId = string(p.id) || string(p.eventId) || string(source.sourceId);
    if (!sourceId) { unlocatedCount++; continue; }
    const id = `${kind}:${sourceId}:${string(p.impactId)}`;
    const recurrences = Array.isArray(duration.recurrences) ? duration.recurrences.filter(validRecurrence) : [];
    let sourceUrl = TRAFFIC_URL;
    try { const url = new URL(string(p.weblinkURL)); if (url.protocol === 'https:' || url.protocol === 'http:') sourceUrl = url.href; } catch { /* Official traffic site is the fallback. */ }
    notices.set(id, {
      id, kind, road: string(p.closedRoadName) || string(p.declaredRoadName) || string(reference.localRoadName) || 'Road location',
      event: string(p.eventType) || 'Road disruption', impact: string(impact.impactType) || string(p.roadAccessType) || 'Impact details not supplied',
      direction: string(impact.direction), description: string(p.description), lanes: string(p.numberLanesImpacted ?? impact.numberLanesImpacted), paths,
      start: kind === 'planned' ? melbourneInstant(duration.start) : melbourneInstant(p.lastActive ?? p.created),
      end: kind === 'planned' ? melbourneInstant(duration.end) : null,
      recurrences, scheduleUncertain: duration.recurrences != null && (!Array.isArray(duration.recurrences) || recurrences.length !== duration.recurrences.length),
      updatedAt: melbourneInstant(p.lastUpdated), nextUpdateAt: kind === 'unplanned' ? melbourneInstant(p.nextUpdateDue ?? p.endTime) : null, sourceUrl,
    });
  }
  return { notices: [...notices.values()], unlocatedCount };
}
/** Minimum distance to road segments, rather than just the endpoints of a long road. */
export function roadDistance(notice: RoadNotice, sensor: { lat: number; lon: number }): number {
  const scale = 111195, cos = Math.cos(sensor.lat * Math.PI / 180);
  const xy = ([lon, lat]: Position): Position => [(lon - sensor.lon) * scale * cos, (lat - sensor.lat) * scale];
  let nearest = Infinity;
  for (const path of notice.paths) {
    const points = path.map(xy);
    for (let n = 0; n < points.length; n++) {
      const a = points[n], b = points[n + 1] ?? a, dx = b[0] - a[0], dy = b[1] - a[1];
      const t = dx || dy ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / (dx * dx + dy * dy))) : 0;
      nearest = Math.min(nearest, Math.hypot(a[0] + t * dx, a[1] + t * dy));
    }
  }
  return nearest;
}
export function plannedAtHour(notice: RoadNotice, selectedTime: string): 'overlap' | 'outside' | 'uncertain' {
  const hour = Date.parse(selectedTime), finish = hour + 3600000;
  const start = notice.start ? Date.parse(notice.start) : null, end = notice.end ? Date.parse(notice.end) : null;
  if (!Number.isFinite(hour)) return 'uncertain';
  if ((start !== null && start >= finish) || (end !== null && end <= hour)) return 'outside';
  if (start === null || end === null || end <= start || notice.scheduleUncertain) return 'uncertain';
  if (!notice.recurrences.length) return 'overlap';
  const local = wallParts(hour);
  for (const r of notice.recurrences) {
    // Yesterday is included for overnight works; tomorrow for a DST transition hour.
    for (const shift of [-1, 0, 1]) {
      const day = new Date(Date.UTC(local[0], local[1] - 1, local[2] + shift));
      const weekdayOffset = (day.getUTCDay() - weekdays.indexOf(r.startDay) + 7) % 7;
      if (weekdayOffset >= r.daysDuration) continue;
      const [h, m] = r.allDay ? [0, 0] : r.startTime.split(':').map(Number);
      const begins = wallInstant([day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), h, m, 0]);
      const tomorrow = new Date(day.getTime() + 86400000);
      const ends = r.allDay ? wallInstant([tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), 0, 0, 0]) : begins === null ? null : begins + durationMs(r.duration)!;
      if (begins === null || ends === null) return 'uncertain';
      if (Math.max(begins, start) < finish && Math.min(ends, end) > hour) return 'overlap';
    }
  }
  return 'outside';
}
export function nearbyRoadNotices(feed: RoadFeed, sensor: { lat: number; lon: number }, selectedTime: string, radius: number, closuresOnly = false) {
  if (feed.status !== 'ready') return [];
  return feed.notices.flatMap(notice => {
    const distance = roadDistance(notice, sensor);
    const timing = notice.kind === 'planned' ? plannedAtHour(notice, selectedTime) : 'overlap';
    const closure = /closed|closure|blocked/i.test(notice.impact) && !/no\s*blockage/i.test(notice.impact);
    return distance <= radius && timing !== 'outside' && (!closuresOnly || closure) ? [{ notice, distance, timing }] : [];
  }).sort((a, b) => a.distance - b.distance || a.notice.id.localeCompare(b.notice.id));
}
export function roadFeedFresh(feed: RoadFeed, now: number) {
  const checked = feed.checkedAt ? Date.parse(feed.checkedAt) : NaN;
  return feed.status === 'ready' && Number.isFinite(checked) && checked <= now + 60000 && now - checked < (feed.refreshSeconds + 120) * 1000;
}
