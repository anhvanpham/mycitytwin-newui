import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { RoadDisruptionsView } from './RoadDisruptionsPanel';
import { normalizeRoadFeatures, REFRESH_SECONDS, ROAD_SOURCES, type RoadDoc } from '../data/roadDisruptions';

const now = Date.parse('2026-10-10T04:00:00Z');
const props = { sensor: { name: 'Melbourne Central', lat: -37.81, lon: 144.962 }, selectedTime: '2026-10-10T15:00:00+11:00', now, error: false, loading: false, refresh: () => {} };
const doc = (status: 'ready' | 'unconfigured' | 'unavailable', checkedAt = new Date(now).toISOString()): RoadDoc => ({ schemaVersion: 1, feeds: (['planned', 'unplanned'] as const).map(kind => ({ kind, status, checkedAt: status === 'ready' ? checkedAt : null, refreshSeconds: REFRESH_SECONDS[kind], sourceUrl: ROAD_SOURCES[kind], notices: [], unlocatedCount: 0 })) });

it('shows a setup state without claiming zero closures', () => {
  const html = renderToStaticMarkup(<RoadDisruptionsView {...props} doc={doc('unconfigured')}/>);
  expect(html).toContain('aren’t connected yet'); expect(html).not.toContain('No closure'); expect(html).not.toContain('No notices');
  expect(html).toContain('Planned for this hour'); expect(html).toContain('Unexpected now');
});
it('distinguishes fresh reported zero, outages, stale data and historical dates', () => {
  const render = (data: RoadDoc, extra = {}) => renderToStaticMarkup(<RoadDisruptionsView {...props} {...extra} doc={data}/>);
  expect(render(doc('ready'))).toContain('No notices reported');
  expect(render(doc('unavailable'))).toContain('temporarily unavailable');
  expect(render(doc('ready', '2026-10-09T00:00:00Z'))).toContain('need a fresh update');
  expect(render(doc('ready'), { selectedTime: '2026-10-09T15:00:00+11:00' })).toContain('Past road conditions');
});
it('renders published notices with uncertain schedules visibly marked', () => {
  const data = doc('ready'); data.feeds[0].notices = normalizeRoadFeatures([{ geometry: { type: 'Point', coordinates: [144.962, -37.81] }, properties: { id: '1', closedRoadName: 'La Trobe Street', eventType: 'Roadworks', impact: { impactType: 'Lanes closed' }, duration: { start: '2026-10-10T00:00:00' } } }], 'planned').notices;
  const html = renderToStaticMarkup(<RoadDisruptionsView {...props} doc={data}/>);
  expect(html).toContain('La Trobe Street'); expect(html).toContain('Timing needs checking'); expect(html).toContain('Finish not supplied');
  expect(html).toContain('Notices do not change pedestrian forecasts');
});
