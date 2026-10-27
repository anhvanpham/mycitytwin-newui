import { describe, expect, it } from 'vitest';
import { melbourneInstant, nearbyRoadNotices, normalizeRoadFeatures, plannedAtHour, roadDistance, roadFeedFresh, type RoadFeed, type RoadNotice } from './roadDisruptions';

const feature = (properties: Record<string, unknown>, geometry: unknown = { type: 'Point', coordinates: [144.962, -37.81] }) => ({ geometry, properties: { id: 'one', closedRoadName: 'La Trobe Street', ...properties } });
const planned = (duration: Record<string, unknown> = { start: '2026-10-10T00:00:00', end: '2026-10-14T00:00:00' }) => normalizeRoadFeatures([feature({ duration, impact: { impactType: 'Lanes closed' } })], 'planned').notices[0];
const sensor = { lon: 144.962, lat: -37.81 };
const feed = (notice: RoadNotice): RoadFeed => ({ kind: 'planned', status: 'ready', checkedAt: '2026-10-10T00:00:00Z', refreshSeconds: 1800, sourceUrl: '', notices: [notice], unlocatedCount: 0 });

describe('official road notices', () => {
  it('interprets Victorian timestamps in summer and winter, independent of server timezone', () => {
    expect(melbourneInstant('2026-10-10T15:00:00')).toBe('2026-10-10T04:00:00.000Z');
    expect(melbourneInstant('2026-07-10T15:00:00')).toBe('2026-07-10T05:00:00.000Z');
    expect(melbourneInstant('2026-10-10T15:00:00+11:00')).toBe('2026-10-10T04:00:00.000Z');
    expect(melbourneInstant('2026-10-04T02:30:00')).toBeNull();
    expect(melbourneInstant('2026-02-30T15:00:00')).toBeNull();
  });
  it('finds roads crossing the radius even when both endpoints are outside it', () => {
    const n = normalizeRoadFeatures([feature({}, { type: 'GeometryCollection', geometries: [{ type: 'LineString', coordinates: [[144.94, -37.81], [144.98, -37.81]] }] })], 'planned').notices[0];
    expect(roadDistance(n, sensor)).toBeLessThan(1);
    expect(nearbyRoadNotices(feed(n), sensor, '2026-10-10T15:00:00+11:00', 500)).toHaveLength(1);
  });
  it('keeps planned notices only during overlapping published hours', () => {
    const n = planned({ start: '2026-10-10T15:30:00', end: '2026-10-10T17:00:00' });
    expect(plannedAtHour(n, '2026-10-10T15:00:00+11:00')).toBe('overlap');
    expect(plannedAtHour(n, '2026-10-10T14:00:00+11:00')).toBe('outside');
    expect(plannedAtHour(n, '2026-10-10T17:00:00+11:00')).toBe('outside');
  });
  it('checks weekday work windows and overnight recurrence carryover', () => {
    const n = planned({ start: '2026-10-01T00:00:00', end: '2026-11-01T00:00:00', recurrences: [{ startDay: 'Monday', daysDuration: 5, startTime: '22:00', duration: 'PT5H', allDay: false }] });
    expect(plannedAtHour(n, '2026-10-10T01:00:00+11:00')).toBe('overlap'); // Friday night → Saturday
    expect(plannedAtHour(n, '2026-10-10T15:00:00+11:00')).toBe('outside');
    expect(plannedAtHour(n, '2026-10-11T01:00:00+11:00')).toBe('outside');
  });
  it('treats all-day recurrence as a local calendar day across the DST change', () => {
    const n = planned({ start: '2026-10-01T00:00:00', end: '2026-11-01T00:00:00', recurrences: [{ startDay: 'Sunday', daysDuration: 1, allDay: true }] });
    expect(plannedAtHour(n, '2026-10-04T23:00:00+11:00')).toBe('overlap');
    expect(plannedAtHour(n, '2026-10-05T00:00:00+11:00')).toBe('outside');
  });
  it('labels missing or invalid schedules uncertain, while respecting known outer bounds', () => {
    expect(plannedAtHour(planned({ start: '2026-10-10T00:00:00' }), '2026-10-10T15:00:00+11:00')).toBe('uncertain');
    const n = planned({ start: '2026-10-10T00:00:00', end: '2026-10-14T00:00:00', recurrences: [{}] });
    expect(plannedAtHour(n, '2026-10-10T15:00:00+11:00')).toBe('uncertain');
    expect(plannedAtHour(n, '2026-10-15T15:00:00+11:00')).toBe('outside');
  });
  it('excludes reopened, pending and tow allocation records and preserves separate impacts', () => {
    const rows = [feature({ status: 'Active', impactId: 'A', endTime: '2026-10-09T12:00:00' }), feature({ status: 'Active', impactId: 'B' }), feature({ status: 'Active', eventLocationStatus: 'Reopened' }), feature({ status: 'Pending' }), feature({ status: 'Active', source: { sourceName: 'TowAllocation' } })];
    const notices = normalizeRoadFeatures(rows, 'unplanned').notices;
    expect(notices).toHaveLength(2);
    expect(new Set(notices.map(n => n.id)).size).toBe(2);
    expect(notices[0].end).toBeNull(); // v3 endTime may be next update due, not reopening
    expect(notices[0].nextUpdateAt).toBe('2026-10-09T01:00:00.000Z');
    expect(nearbyRoadNotices({ ...feed(notices[0]), kind: 'unplanned' }, sensor, '2030-01-01T00:00:00+11:00', 1000)).toHaveLength(1);
  });
  it('distinguishes missing locations and closure filters from actual reported zero', () => {
    expect(normalizeRoadFeatures([feature({}, null)], 'planned').unlocatedCount).toBe(1);
    const n = planned();
    expect(nearbyRoadNotices(feed(n), sensor, '2026-10-10T15:00:00+11:00', 1000, true)).toHaveLength(1);
    expect(nearbyRoadNotices(feed({ ...n, impact: 'No blockage' }), sensor, '2026-10-10T15:00:00+11:00', 1000, true)).toHaveLength(0);
    expect(nearbyRoadNotices({ ...feed(n), status: 'unavailable' }, sensor, '2026-10-10T15:00:00+11:00', 1000)).toHaveLength(0);
    expect(roadFeedFresh(feed(n), Date.parse('2026-10-10T00:10:00Z'))).toBe(true);
    expect(roadFeedFresh(feed(n), Date.parse('2026-10-10T00:35:00Z'))).toBe(false);
  });
});
