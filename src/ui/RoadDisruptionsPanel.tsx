import { useState } from 'react';
import { nearbyRoadNotices, roadFeedFresh, TRAFFIC_URL, ROAD_SOURCES, type RoadDoc, type RoadFeedKind } from '../data/roadDisruptions';
import { findRoadFeed, useRoadDisruptions } from '../data/useRoadDisruptions';
import '../styles/road-disruptions.css';

const stamp = (value: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const day = (value: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
interface Props { sensor: { name: string; lat: number; lon: number }; selectedTime: string; now: number }
interface ViewProps extends Props { doc: RoadDoc | null; error: boolean; loading: boolean; refresh: () => void }

export function RoadDisruptionsView({ sensor, selectedTime, now, doc, error, loading, refresh }: ViewProps) {
  const [kind, setKind] = useState<RoadFeedKind>('planned');
  const [radius, setRadius] = useState(1000);
  const [closuresOnly, setClosuresOnly] = useState(false);
  const feed = findRoadFeed(doc, kind);
  const historic = kind === 'planned' && day(Date.parse(selectedTime)) < day(now);
  const fresh = feed ? roadFeedFresh(feed, now) : false;
  const notices = feed && fresh && !historic ? nearbyRoadNotices(feed, sensor, selectedTime, radius, closuresOnly) : [];
  const unconfigured = doc?.feeds.every(f => f.status === 'unconfigured');
  const badge = unconfigured || feed?.status === 'unconfigured' ? 'Not connected' : error || feed?.status === 'unavailable' ? 'Unavailable' : feed?.status === 'ready' && !fresh ? 'Needs update' : historic ? 'Past date' : !feed ? 'Checking…' : `${notices.length} nearby`;
  return <details className="road-notices" data-kind={kind}>
    <summary><span className="road-notices__title">Roadworks & closures</span><span className="road-notices__badge">{badge}</span></summary>
    <p className="road-notices__intro">Check road changes near {sensor.name}.</p>
    <div className="road-notices__tabs" role="group" aria-label="Road notice time frame">
      <button type="button" aria-pressed={kind === 'planned'} onClick={() => setKind('planned')}>Planned for this hour</button>
      <button type="button" aria-pressed={kind === 'unplanned'} onClick={() => setKind('unplanned')}>Unexpected now</button>
    </div>
    <p className="road-notices__time">{kind === 'planned' ? `Selected hour · ${stamp(selectedTime)} (Melbourne)` : 'Reported now · these are not predictions for the selected hour.'}</p>
    {fresh && !historic && <div className="road-notices__filters">
      <label>Distance from sensor<select value={radius} onChange={e => setRadius(Number(e.target.value))}><option value={500}>Within 500 m</option><option value={1000}>Within 1 km</option><option value={2000}>Within 2 km</option></select></label>
      <label className="road-notices__check"><input type="checkbox" checked={closuresOnly} onChange={e => setClosuresOnly(e.target.checked)}/>Closures only</label>
    </div>}
    <div className="road-notices__results" aria-live="polite" aria-busy={loading}>
      {unconfigured || feed?.status === 'unconfigured' ? <div className="road-notices__empty"><strong>Live road notices aren’t connected yet.</strong><p>Use the official traffic site to check planned works and current closures.</p></div>
        : error || feed?.status === 'unavailable' || (feed?.status === 'ready' && !fresh) ? <div className="road-notices__empty"><strong>{feed?.status === 'ready' ? 'Road notices need a fresh update.' : 'Road notices are temporarily unavailable.'}</strong><p>We can’t confirm road conditions from this feed. Check the official traffic site.</p></div>
        : historic ? <p>Past road conditions aren’t available from this live feed. Choose today or a future forecast date to check published plans.</p>
        : !feed ? <p>Checking road notices…</p>
        : notices.length ? <ul className="road-notices__list">{notices.map(({ notice: n, distance, timing }) => <li key={n.id} className={`road-notice road-notice--${kind}`}>
            <div className="road-notice__heading"><strong>{n.road}</strong><span>{Math.max(10, Math.round(distance / 10) * 10).toLocaleString()} m away</span></div>
            <p className="road-notice__impact">{n.impact}{n.direction && ` · ${n.direction}`}{n.lanes && ` · ${n.lanes} lanes affected`}</p>
            <span className="road-notice__category">{n.event}</span>
            {timing === 'uncertain' && <p className="road-notice__uncertain">Timing needs checking — this notice may affect the selected hour.</p>}
            {n.description && <p>{n.description}</p>}
            {kind === 'planned' && <p className="road-notice__meta">{n.start ? stamp(n.start) : 'Start not supplied'} → {n.end ? stamp(n.end) : 'Finish not supplied'}{n.recurrences.length > 0 && ' · recurring work windows'}</p>}
            {n.updatedAt && <p className="road-notice__meta">Notice updated {stamp(n.updatedAt)}</p>}
            {kind === 'unplanned' && n.nextUpdateAt && <p className="road-notice__meta">Next update expected {stamp(n.nextUpdateAt)} · reopening time not confirmed</p>}
            <a href={n.sourceUrl} target="_blank" rel="noreferrer">Check official notice</a>
          </li>)}</ul>
        : <p>No {closuresOnly ? 'closure ' : ''}notices reported within {radius === 500 ? '500 m' : `${radius / 1000} km`}{kind === 'planned' ? ' for this hour' : ' now'}. This doesn’t confirm that every road is open.</p>}
    </div>
    <div className="road-notices__footer"><a href={TRAFFIC_URL} target="_blank" rel="noreferrer">Open official traffic updates</a>{!unconfigured && <button type="button" disabled={loading} onClick={refresh}>{loading ? 'Checking…' : 'Refresh notices'}</button>}</div>
    {feed?.checkedAt && <p className="road-notice__meta">Feed checked {stamp(feed.checkedAt)} · {kind === 'planned' ? 'source refreshes about every 30 minutes' : 'source refreshes about every minute'}.</p>}
    <p className="road-notices__coverage">{kind === 'planned' ? 'Published plans cover roads managed by Transport Victoria.' : 'Reported incidents cover state and local roads.'} Coverage is incomplete{feed?.unlocatedCount ? `; ${feed.unlocatedCount} notices have no usable location` : ''}. Distance is approximate, not a walking route. Notices do not change pedestrian forecasts.</p>
    <a className="road-notices__source" href={ROAD_SOURCES[kind]} target="_blank" rel="noreferrer">Transport Victoria data source</a>
  </details>;
}
export function RoadDisruptionsPanel(props: Props) {
  const state = useRoadDisruptions();
  return <RoadDisruptionsView {...props} {...state}/>;
}
