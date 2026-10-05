import { useEffect, useState } from 'react';
import { bundled } from './bundled';
import { projectLonLat } from './project';
import { LOCAL_ORIGIN_WGS84 } from '../scene/frame';
import { insideCBD } from '../scene/cbdBoundary';

export interface ActivitySensor {
  id: number; name: string; lat: number; lon: number; lastObserved: string; model: string;
  counts: (number | null)[]; activity: ('quiet' | 'moderate' | 'busy' | 'unknown')[];
}
export interface ActivityWeather { temperature: number; rain: number; wind: number; bomChance: number | null; bomPrecis: string | null }
export interface ActivityEvent {
  id: string; name: string; venue: string; start: string; end: string;
  lat: number; lon: number; knownAt: string; sourceUrl: string; categories?: string[]; provider?: string; timing?: 'session' | 'start' | 'date';
  accessPoints?: { name: string; lat: number; lon: number; radiusM: number; sourceUrl: string }[];
}
export interface ActivityDoc {
  schemaVersion: 1; exportedAt: string; forecastOrigin: string; weatherFetchedAt: string;
  weatherSource: string; bomIssuedAt: string; sensorsSource: string; countsSource: string;
  weatherUrl: string; eventCoverage: string; eventsFetchedAt?: string | null; times: string[]; sensors: ActivitySensor[];
  weather: ActivityWeather[]; events: ActivityEvent[];
  sportsCoverage?: { fetchedAt: string; coverage: string; sources: { provider: string; name: string; sourceUrl: string; status: 'checked' | 'unavailable'; checkedAt?: string; listedCount?: number; inForecastCount?: number }[] };
  coverage?: { reportingCount: number; insideCBDCount: number; forecastCount: number; completeForecastCount: number; partial: { location_id: number; reason: string; missingHours: number }[]; excludedCount: number; inventoryFetchedAt: string; boundary: string; unavailable: { location_id: number; reason: string }[] };
}
const origin = projectLonLat(LOCAL_ORIGIN_WGS84.lon, LOCAL_ORIGIN_WGS84.lat);
export function sensorPosition(sensor: Pick<ActivitySensor, 'lon' | 'lat'>): [number, number] {
  const [e, n] = projectLonLat(sensor.lon, sensor.lat);
  return [e - origin[0], n - origin[1]];
}
export const visibleSensors = (doc: ActivityDoc) => doc.sensors.filter(s => insideCBD(sensorPosition(s)));

/** Fail closed on missing hours or misaligned columns instead of painting invented zeroes. */
export function validateActivity(raw: unknown): ActivityDoc {
  const d = raw as ActivityDoc;
  const validTime = (s: unknown) => typeof s === 'string' && Number.isFinite(Date.parse(s));
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
  if (!d || d.schemaVersion !== 1 || !Array.isArray(d.times) || !d.times.length ||
      !Array.isArray(d.sensors) || !d.sensors.length || !Array.isArray(d.weather) ||
      !Array.isArray(d.events) || d.weather.length !== d.times.length ||
      ![d.exportedAt, d.forecastOrigin, d.weatherFetchedAt, d.bomIssuedAt].every(validTime) ||
      (d.eventsFetchedAt != null && !validTime(d.eventsFetchedAt)) ||
      !d.times.every((t, i) => validTime(t) && /^\d{4}-\d{2}-\d{2}T\d{2}:00:00[+-]\d{2}:\d{2}$/.test(t) &&
        (i === 0 || Date.parse(t) - Date.parse(d.times[i - 1]) === 3600000)) ||
      new Set(d.sensors.map(s => s.id)).size !== d.sensors.length ||
      !d.sensors.every(s => finite(s.id) && typeof s.name === 'string' && finite(s.lat) && finite(s.lon) &&
        Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180 && validTime(s.lastObserved) &&
        Array.isArray(s.counts) && s.counts.length === d.times.length && s.counts.every(n => n === null || (finite(n) && n >= 0)) &&
        Array.isArray(s.activity) && s.activity.length === d.times.length &&
        s.activity.every((a, i) => s.counts[i] === null ? a === 'unknown' : ['quiet', 'moderate', 'busy'].includes(a))) ||
      !d.weather.every(w => finite(w.temperature) && finite(w.rain) && w.rain >= 0 && finite(w.wind) && w.wind >= 0 &&
        (w.bomChance === null || (finite(w.bomChance) && w.bomChance >= 0 && w.bomChance <= 100))) ||
      (d.sportsCoverage != null && (!validTime(d.sportsCoverage.fetchedAt) || !Array.isArray(d.sportsCoverage.sources) || !d.sportsCoverage.sources.every(s => typeof s.name === 'string' && /^https:\/\//.test(s.sourceUrl) && ['checked', 'unavailable'].includes(s.status) && (s.status === 'unavailable' || (validTime(s.checkedAt) && finite(s.inForecastCount) && s.inForecastCount! >= 0))))) ||
      !d.events.every(e => validTime(e.start) && validTime(e.end) && Date.parse(e.end) >= Date.parse(e.start) &&
        validTime(e.knownAt) && finite(e.lat) && finite(e.lon) && typeof e.name === 'string' && /^https:\/\//.test(e.sourceUrl) &&
        (e.timing == null || ['session', 'start', 'date'].includes(e.timing)) &&
        (e.accessPoints == null || (Array.isArray(e.accessPoints) && e.accessPoints.every(p => typeof p.name === 'string' && finite(p.lat) && Math.abs(p.lat) <= 90 && finite(p.lon) && Math.abs(p.lon) <= 180 && finite(p.radiusM) && p.radiusM > 0 && p.radiusM <= 1000 && /^https:\/\//.test(p.sourceUrl)))))) {
    throw new Error('The street activity forecast is incomplete. Refresh the forecast data and try again.');
  }
  return d;
}

export function useStreetActivity(enabled: boolean) {
  const [doc, setDoc] = useState<ActivityDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch(bundled('data/street-activity.json'), { signal: controller.signal, cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('Street activity data could not be loaded.'); return r.json(); })
      .then(validateActivity).then(d => { setDoc(d); setError(null); })
      .catch((e: Error) => { if (!controller.signal.aborted) { setDoc(null); setError(e.message); } });
    return () => controller.abort();
  }, [enabled, attempt]);
  return { doc, error, retry: () => { setError(null); setAttempt(n => n + 1); } };
}

/** One count scale for both the map and hourly heat map, not relative busyness. */
export function activityColor(count: number | null, maximum: number): string {
  if (count === null) return '#d9ded9';
  const t = Math.sqrt(Math.max(0, Math.min(1, count / Math.max(1, maximum))));
  const a = t < .5 ? [143, 204, 196] : [233, 200, 118];
  const b = t < .5 ? [233, 200, 118] : [203, 105, 94];
  const f = t < .5 ? t * 2 : (t - .5) * 2;
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(',')})`;
}

export function nearestHour(doc: ActivityDoc, instant: number): number {
  const future = doc.times.findIndex(t => Date.parse(t) >= instant);
  return future < 0 ? doc.times.length - 1 : future;
}
/** Keep a simulation on one Melbourne date, clamping to that day's weather coverage. */
export function hourOnDate(doc: Pick<ActivityDoc, 'times'>, day: string, hour: number): number | null {
  let closest: number | null = null;
  let distance = Infinity;
  doc.times.forEach((time, index) => {
    if (time.slice(0, 10) !== day) return;
    const delta = Math.abs(Number(time.slice(11, 13)) - hour);
    if (delta < distance) { closest = index; distance = delta; }
  });
  return closest;
}

export function weatherSuitable(w: ActivityWeather): boolean {
  return w.temperature >= 12 && w.temperature <= 30 && w.rain <= .5 && w.wind <= 30 && (w.bomChance === null || w.bomChance <= 60);
}

/** A warning area is a venue or a sourced CBD station approach, never a crowd estimate. */
export function eventWarningArea(event: ActivityEvent, sensor: ActivitySensor): string | null {
  const distance = (lat: number, lon: number) => {
    const r = Math.PI / 180;
    const a = Math.sin((lat - sensor.lat) * r / 2) ** 2 + Math.cos(sensor.lat * r) * Math.cos(lat * r) * Math.sin((lon - sensor.lon) * r / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  };
  if (distance(event.lat, event.lon) <= 1000) return 'Near the venue';
  return event.accessPoints?.find(p => distance(p.lat, p.lon) <= p.radiusM)?.name ?? null;
}

/** Date-only tournament ranges are context; they never flag every hour as busy. */
export function nearbyEvents(doc: ActivityDoc, sensor: ActivitySensor, index: number): ActivityEvent[] {
  const hour = Date.parse(doc.times[index]);
  return doc.events.filter(e => e.timing !== 'date' && eventWarningArea(e, sensor) !== null &&
    Date.parse(e.knownAt) <= Date.parse(doc.exportedAt) &&
    hour + 3600000 > Date.parse(e.start) - 7200000 && hour < Date.parse(e.end) + 7200000);
}

export function recommendations(doc: ActivityDoc, sensor: ActivitySensor, preference: 'quiet' | 'busy', now = Date.now()): number[] {
  const eligible = doc.times.map((t, i) => ({ t, i })).filter(({ t, i }) => {
    const hour = Number(t.slice(11, 13));
    return Date.parse(t) >= now && hour >= 8 && hour <= 21 && weatherSuitable(doc.weather[i]) && sensor.counts[i] !== null;
  }).sort((a, b) => (preference === 'quiet' ? 1 : -1) * (sensor.counts[a.i]! - sensor.counts[b.i]!) || Date.parse(a.t) - Date.parse(b.t));
  // One suggestion per day, so a run of three neighbouring hours does not fill the list.
  const days = new Set<string>();
  return eligible.filter(({ t }) => { const day = t.slice(0, 10); if (days.has(day)) return false; days.add(day); return true; }).slice(0, 3).map(x => x.i);
}
