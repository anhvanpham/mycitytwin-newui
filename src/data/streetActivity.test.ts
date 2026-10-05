import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { activityColor, eventWarningArea, hourOnDate, nearbyEvents, nearestHour, recommendations, validateActivity, visibleSensors, weatherSuitable } from './streetActivity';
import { readUrlState, writeUrlState } from './urlState';
const snapshot = () => validateActivity(JSON.parse(readFileSync(resolve(__dirname, '../../public/data/street-activity.json'), 'utf8')));
afterEach(() => vi.unstubAllGlobals());

describe('street activity data and recommendations', () => {
  it('loads real aligned hourly sensor columns within the existing map boundary', () => {
    const d = snapshot();
    expect(d.times.length).toBeGreaterThan(24);
    expect(visibleSensors(d).length).toBeGreaterThan(0);
    expect(Date.parse(d.times.at(-1)!)).toBeGreaterThan(Date.parse(d.times[0]));
  });
  it('rejects missing weather hours and missing sensor counts', () => {
    const d = snapshot(); d.weather.pop(); expect(() => validateActivity(d)).toThrow('incomplete');
    const e = snapshot(); e.sensors[0].counts.pop(); expect(() => validateActivity(e)).toThrow('incomplete');
  });
  it('shows missing sensor observations as unavailable, never zero, and excludes them from suggestions', () => {
    const d = snapshot(), s = d.sensors[0];
    const index = recommendations(d, s, 'quiet', Date.parse(d.times[0]))[0];
    s.counts[index] = null; s.activity[index] = 'unknown';
    expect(validateActivity(d)).toBe(d);
    expect(activityColor(null, 1000)).not.toBe(activityColor(0, 1000));
    expect(recommendations(d, s, 'quiet', Date.parse(d.times[0]))).not.toContain(index);
  });
  it('rejects gaps and duplicated hours instead of silently filling them', () => {
    const d = snapshot(); d.times[1] = d.times[0]; expect(() => validateActivity(d)).toThrow('incomplete');
  });
  it('uses official BOM daily rain chance when present, hourly limits when absent', () => {
    const w = { temperature: 20, rain: 0, wind: 5, bomChance: null, bomPrecis: null };
    expect(weatherSuitable(w)).toBe(true);
    expect(weatherSuitable({ ...w, bomChance: 90 })).toBe(false);
    expect(weatherSuitable({ ...w, rain: 1 })).toBe(false);
  });
  it('flags verified nearby events with a buffer and never an event first known later', () => {
    const d = snapshot(), s = d.sensors[0];
    d.events = [{ id: 'test', name: 'Concert', venue: 'Test venue', lat: s.lat, lon: s.lon,
      start: d.times[10], end: d.times[11], knownAt: d.exportedAt, sourceUrl: 'https://example.org/event' }];
    expect(nearbyEvents(d, s, 8)).toHaveLength(1);
    expect(nearbyEvents(d, s, 13)).toHaveLength(0);
    d.events[0].knownAt = new Date(Date.parse(d.exportedAt) + 3600000).toISOString();
    expect(nearbyEvents(d, s, 10)).toHaveLength(0);
  });
  it('shows sports dates as calendar context without an hourly warning', () => {
    const d = snapshot(), sensor = d.sensors[0];
    d.events = [{ id: 'ao', name: 'Australian Open', venue: 'Melbourne Park', lat: sensor.lat, lon: sensor.lon,
      start: d.times[0], end: d.times[23], knownAt: d.exportedAt, sourceUrl: 'https://ausopen.com/ticket-faqs', timing: 'date', categories: ['Sport', 'Tennis'] }];
    expect(validateActivity(d)).toBe(d);
    expect(nearbyEvents(d, sensor, 10)).toEqual([]);
  });
  it('flags a sourced CBD station approach for a distant AFL venue within the start window', () => {
    const d = snapshot(), sensor = d.sensors[0];
    const e = { id: 'afl', name: 'AFL match', venue: 'MCG', lat: sensor.lat - .03, lon: sensor.lon + .03,
      start: d.times[10], end: d.times[10], knownAt: d.exportedAt, sourceUrl: 'https://www.mcg.org.au/events', timing: 'start' as const,
      accessPoints: [{ name: 'Flinders Street station approach', lat: sensor.lat, lon: sensor.lon, radiusM: 400, sourceUrl: 'https://www.mcg.org.au/plan-a-visit/get-to-the-mcg' }] };
    d.events = [e];
    expect(validateActivity(d)).toBe(d);
    expect(eventWarningArea(e, sensor)).toBe('Flinders Street station approach');
    expect(nearbyEvents(d, sensor, 8)).toHaveLength(1);
    expect(nearbyEvents(d, sensor, 12)).toHaveLength(0);
    e.accessPoints[0].lat += .02;
    expect(nearbyEvents(d, sensor, 10)).toHaveLength(0);
    e.accessPoints[0].radiusM = 100000;
    expect(() => validateActivity(d)).toThrow('incomplete');
  });
  it('records independent official sporting source coverage and a tennis listing', () => {
    const d = snapshot();
    expect(d.sportsCoverage?.sources.map(s => s.provider)).toEqual(['mcg', 'marvel', 'ao']);
    expect(d.events.some(e => e.categories?.includes('Tennis') && e.timing === 'date')).toBe(true);
  });
  it('never recommends elapsed hours or hours beyond weather coverage', () => {
    const d = snapshot(), s = d.sensors[0], now = Date.parse(d.times[24]);
    const result = recommendations(d, s, 'quiet', now);
    expect(result.length).toBeGreaterThan(0);
    for (const i of result) {
      expect(Date.parse(d.times[i])).toBeGreaterThanOrEqual(now);
      expect(weatherSuitable(d.weather[i])).toBe(true);
    }
    expect(recommendations(d, s, 'quiet', Date.parse(d.times.at(-1)!) + 3600000)).toEqual([]);
    expect(new Set(result.map(i => d.times[i].slice(0, 10))).size).toBe(result.length);
  });
  it('includes timed comedy sessions and more than one official event source', () => {
    const d = snapshot();
    expect(d.events.some(e => e.categories?.includes('Comedy'))).toBe(true);
    expect(new Set(d.events.map(e => new URL(e.sourceUrl).hostname)).size).toBeGreaterThan(1);
    for (const e of d.events) {
      if (e.timing === 'start') expect(e.end).toBe(e.start);
      else expect(Date.parse(e.end)).toBeGreaterThan(Date.parse(e.start));
      expect(Date.parse(e.knownAt)).toBeLessThanOrEqual(Date.parse(d.exportedAt));
    }
  });
  it('keeps recommendations and count values unchanged when nearby events are added', () => {
    const d = snapshot(), s = d.sensors[0], now = Date.parse(d.times[0]);
    d.events = [];
    const before = recommendations(d, s, 'quiet', now);
    const counts = [...s.counts];
    const i = before[0];
    d.events = [{ id: 'warning', name: 'Concert', venue: 'Nearby venue', lat: s.lat, lon: s.lon,
      start: d.times[i], end: d.times[i], knownAt: d.exportedAt, sourceUrl: 'https://example.org/event' }];
    expect(nearbyEvents(d, s, i)).toHaveLength(1);
    expect(recommendations(d, s, 'quiet', now)).toEqual(before);
    expect(s.counts).toEqual(counts);
  });
  it('covers every eligible sensor in the selected reporting inventory', () => {
    const d = snapshot();
    expect(d.coverage).toBeDefined();
    expect(d.sensors.length).toBe(d.coverage!.insideCBDCount);
    expect(visibleSensors(d).length).toBe(d.coverage!.insideCBDCount);
    expect(d.coverage!.forecastCount + d.coverage!.unavailable.length).toBe(d.coverage!.insideCBDCount);
  });
  it('clamps navigation to the weather horizon and keeps one count colour scale', () => {
    const d = snapshot();
    expect(nearestHour(d, 0)).toBe(0);
    expect(nearestHour(d, Infinity)).toBe(d.times.length - 1);
    expect(activityColor(-1, 1000)).toBe(activityColor(0, 1000));
    expect(activityColor(2000, 1000)).toBe(activityColor(1000, 1000));
    expect(activityColor(1000, 1000)).not.toBe(activityColor(0, 1000));
  });
  it('keeps hour navigation on the chosen date and clamps partial weather days', () => {
    const d = { times: ['2026-10-05T06:00:00+11:00', '2026-10-05T07:00:00+11:00', '2026-10-06T00:00:00+11:00', '2026-10-06T01:00:00+11:00'] };
    expect(hourOnDate(d, '2026-10-05', 0)).toBe(0);
    expect(hourOnDate(d, '2026-10-05', 23)).toBe(1);
    expect(hourOnDate(d, '2026-10-06', 0)).toBe(2);
    expect(hourOnDate(d, '2026-10-06', 23)).toBe(3);
    expect(hourOnDate(d, '2026-10-07', 12)).toBeNull();
  });
  it('reopens a selected sensor at midnight without sunlight-hour clamping', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', { location: { pathname: '/ver-4/', search: '?view=activity&sensor=3&d=2026-10-16&t=0', hash: '' }, history: { replaceState } });
    const state = readUrlState();
    expect(state.view).toBe('activity'); expect(state.minutes).toBe(0); expect(state.activitySensor).toBe(3);
    writeUrlState(state);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/ver-4/?view=activity&d=2026-10-16&t=0&sensor=3');
  });
});
