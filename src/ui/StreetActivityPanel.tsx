import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { eventWarningArea, hourOnDate, nearbyEvents, recommendations, visibleSensors, weatherSuitable, type ActivityDoc, type ActivityWeather } from '../data/streetActivity';

const clock = (t: string) => `${t.slice(11, 16)}`;
const dateLabel = (t: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(t));
const stamp = (t: string) => `${dateLabel(t)}, ${clock(t)}`;
const fetchedLabel = (t: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(t));

function WeatherCard({ weather: w, time }: { weather: ActivityWeather; time: string }) {
  const rainLevel = Math.min(1, w.rain / 5);
  const windLevel = Math.min(1, w.wind / 50);
  const drops = w.rain > 0 ? Math.min(18, 3 + Math.ceil(rainLevel * 15)) : 0;
  const fill = Math.max(0, Math.min(1, (w.temperature + 5) / 45));
  const style = {
    '--rain-duration': `${1.25 - rainLevel * .85}s`,
    '--wind-duration': `${3.2 - windLevel * 2.4}s`,
    '--wind-opacity': .25 + windLevel * .6,
  } as CSSProperties;
  return <section className="activity-weather-card" style={style} aria-label="Weather for the selected forecast hour">
    <div className="activity-weather-heading"><strong>Weather forecast</strong><span>{stamp(time)}</span></div>
    <div className="activity-weather-metrics">
      <div className="activity-weather-metric">
        <div className="activity-weather-visual activity-temperature" aria-hidden="true">
          <svg viewBox="0 0 64 54"><path d="M27 35V10a5 5 0 0 1 10 0v25a10 10 0 1 1-10 0Z" fill="none" stroke="currentColor" strokeWidth="2"/>
            <circle cx="32" cy="43" r="6" fill="var(--thermometer-color)"/>
            <rect x="30" y={35 - fill * 25} width="4" height={8 + fill * 25} rx="2" fill="var(--thermometer-color)"/>
            <path d="M40 13h5m-5 8h3m-3 8h5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
        <strong>{w.temperature.toFixed(1)}°C</strong><span>Temperature</span>
      </div>
      <div className="activity-weather-metric">
        <div className="activity-weather-visual activity-rain" aria-hidden="true">
          <svg viewBox="0 0 64 54"><path d="M14 26a8 8 0 0 1 1-16 12 12 0 0 1 23-1 9 9 0 1 1 10 17Z" fill="currentColor" opacity=".25"/>
            {drops === 0 && <path d="M21 35h22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".3"/>}
          </svg>
          {Array.from({ length: drops }, (_, n) => <i key={n} style={{ left: `${17 + (n * 19 % 67)}%`, animationDelay: `${-(n * .17)}s` }}/>) }
        </div>
        <strong>{w.rain.toFixed(1)} <small>mm/h</small></strong><span>{w.rain > 0 ? 'Rainfall' : 'No rain'}</span>
      </div>
      <div className="activity-weather-metric">
        <div className={`activity-weather-visual activity-wind${w.wind === 0 ? ' is-calm' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 64 54">
            <path d="M6 18h34c12 0 12-12 4-12"/><path d="M3 28h45c12 0 12 12 4 12"/><path d="M12 39h21c9 0 9 9 3 9"/>
          </svg>
        </div>
        <strong>{Math.round(w.wind)} <small>km/h</small></strong><span>{w.wind === 0 ? 'Calm' : 'Wind'}</span>
      </div>
    </div>
    <p className="activity-weather-outlook">{w.bomChance === null ? 'BOM daily forecast unavailable' : `BOM rain chance: ${w.bomChance}%${w.bomPrecis ? ` · ${w.bomPrecis}` : ''}`}</p>
    <p className="activity-weather-status" data-suitable={weatherSuitable(w)}>{weatherSuitable(w) ? 'Within outdoor weather limits' : 'Outside outdoor weather limits'}</p>
  </section>;
}

export function StreetActivityPanel({ doc, error, retry, sensorId, index, onTime, onBack }:{
  doc: ActivityDoc | null; error: string | null; retry: () => void;
  sensorId: number; index: number;
  onTime: (index: number) => void; onBack: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const [preference, setPreference] = useState<'quiet' | 'busy'>('quiet');
  const sensors = doc ? visibleSensors(doc) : [];
  const sensor = sensors.find(s => s.id === sensorId) ?? sensors[0];
  const i = doc ? Math.min(Math.max(0, index), doc.times.length - 1) : 0;
  const time = doc?.times[i];
  const w = doc?.weather[i];
  const expired = doc ? Date.parse(doc.times.at(-1)!) + 3600000 <= now : false;
  const maximum = Math.max(1, ...sensors.flatMap(s => s.counts.filter((c): c is number => c !== null)));
  const days = doc ? [...new Set(doc.times.map(t => t.slice(0, 10)))] : [];
  const suggestions = doc && sensor && !expired ? recommendations(doc, sensor, preference, now) : [];
  const events = doc && sensor ? nearbyEvents(doc, sensor, i) : [];
  const sportCalendar = doc ? doc.events.filter(e => e.provider && Date.parse(e.knownAt) <= Date.parse(doc.exportedAt) && Date.parse(e.end) >= Date.parse(doc.times[0])).slice(0, 5) : [];
  const aflSources = doc?.sportsCoverage?.sources.filter(s => s.provider === 'mcg' || s.provider === 'marvel') ?? [];
  const aflInForecast = doc ? doc.events.filter(e => e.categories?.some(c => c === 'AFL' || c === 'AFLW') && Date.parse(e.start) < Date.parse(doc.times.at(-1)!) + 3600000 && Date.parse(e.end) + 7200000 > Date.parse(doc.times[0])).length : 0;
  const dayIndices = doc && time ? doc.times.flatMap((t, n) => t.slice(0, 10) === time.slice(0, 10) ? [n] : []) : [];
  const firstHour = doc && dayIndices.length ? Number(doc.times[dayIndices[0]].slice(11, 13)) : 0;
  const lastHour = doc && dayIndices.length ? Number(doc.times[dayIndices.at(-1)!].slice(11, 13)) : 0;
  const timebar = useRef<HTMLElement>(null);
  useEffect(() => {
    const bar = timebar.current;
    const app = bar?.closest<HTMLElement>('.app');
    if (!bar || !app) return;
    const measure = () => app.style.setProperty('--activity-dock-height', `${bar.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => { observer.disconnect(); app.style.removeProperty('--activity-dock-height'); };
  }, [doc]);
  return <>
    <aside className="panel panel--left sheet sheet--details activity-panel" aria-label="Street activity forecast">
      <div className="sheet__tabpanel sheet__tabpanel--flow">
      <button type="button" className="activity-back" onClick={onBack}>← Explore the city</button>
      <p className="activity-eyebrow">Plan your time outside</p>
      <h1>Street activity</h1>
      <p className="activity-intro">Find a quieter hour, or enjoy the city when it is lively.</p>
      <p className="activity-caption">Forecasts from observed weekly patterns</p>
      {!doc && <p role="status">{error ?? 'Loading street activity forecasts…'}</p>}
      {error && <button className="button" type="button" onClick={retry}>Try again</button>}
      {doc && sensor && time && w && <>
        <WeatherCard weather={w} time={time}/>
        <div className="activity-field activity-sensor-field">
          <span>Sensor location</span>
          <output className="activity-sensor-name" aria-label="Selected sensor location" aria-live="polite">{sensor.name}</output>
        </div>
        <h2>Suggested times</h2>
        <label className="activity-field">I prefer
          <select value={preference} onChange={e => setPreference(e.target.value as 'quiet' | 'busy')}>
            <option value="quiet">Quieter streets</option><option value="busy">Livelier streets</option>
          </select>
        </label>
        <details className="activity-weather-limits"><summary>Outdoor weather limits</summary><p className="activity-caption">08:00–21:00 · 12–30°C · rain ≤0.5 mm/h · wind ≤30 km/h · BOM rain chance ≤60% where available.</p></details>
        {suggestions.length ? <ul className="activity-suggestions">{suggestions.map(n => <li key={n}>
          <button type="button" onClick={() => onTime(n)}><strong>{stamp(doc.times[n])}</strong><span>{Math.round(sensor.counts[n]!).toLocaleString()} movements/h · {doc.weather[n].temperature.toFixed(1)}°C</span>{nearbyEvents(doc, sensor, n).length > 0 && <span className="activity-event-flag">Nearby event warning</span>}</button>
        </li>)}</ul> : <p role="status">{expired ? 'This forecast has expired. Fresh data is needed for recommendations.' : 'No future hours meet these preferences and weather limits.'}</p>}
        <details className="activity-events"><summary>Nearby events · {events.length} at this hour</summary>
          {events.length ? <div className="activity-event-warning" role="note" aria-label="Nearby event warning">
            <strong>Streets may be busier around these events</strong>
            {events.map(e => <p key={e.id}><a href={e.sourceUrl} target="_blank" rel="noreferrer">{e.name}</a><br/>{e.venue} · {stamp(e.start)}{e.timing === 'start' ? ' · finish time unavailable' : `–${clock(e.end)}`}<br/>{eventWarningArea(e, sensor)}{e.timing === 'start' && ' · warning around the published start'}</p>)}
          </div> : <p>No supplied event overlaps this hour near this sensor.</p>}
          <p>Comedy, music, festivals and sporting events; coverage is incomplete. Warnings cover nearby venues and listed CBD access points, with a two-hour buffer. Start-only listings have no estimated finish. Events do not change predicted counts or recommendations.</p>
          {doc.sportsCoverage && <div className="activity-sports-calendar">
            <strong>Sporting calendar</strong>
            <p>{aflSources.some(s => s.status === 'unavailable') ? 'AFL venue coverage partly unavailable.' : `AFL venue calendars checked · ${aflInForecast} listed matches in these forecast dates.`}</p>
            {sportCalendar.map(e => <p key={e.id}><a href={e.sourceUrl} target="_blank" rel="noreferrer">{e.name}</a><br/>{e.venue} · {e.timing === 'date' ? `${dateLabel(e.start)}–${dateLabel(new Date(Date.parse(e.end) - 86400000).toISOString())} ${new Date(e.start).getFullYear()} · dates only` : stamp(e.start)}<br/>{Date.parse(e.start) > Date.parse(doc.times.at(-1)!) ? 'Outside forecast dates' : e.timing === 'date' ? 'Session times unavailable; check the official schedule.' : 'See the official schedule for event details.'}</p>)}
          </div>}
        </details>
        <div className="activity-legend"><span className="activity-gradient"/><span>0 → {Math.round(maximum).toLocaleString()} movements/h</span></div>
        <details className="activity-sources"><summary>Data & forecast information</summary>
        <p className="activity-caption">{sensors.length} forecast sensors on this CBD map{doc.coverage ? ` · ${doc.coverage.insideCBDCount} inside the CBD out of ${doc.coverage.reportingCount} reporting sensors` : ` · ${doc.sensors.length} in this forecast`}. Unsensed streets are not estimated. Soft halos mark sensor forecasts; grey halos indicate unavailable forecasts. Quiet/busy compares each location with its own history.</p>
        {doc.coverage && doc.coverage.partial.length > 0 && <p className="activity-caption">{doc.coverage.completeForecastCount} sensors have complete hourly forecasts; {doc.coverage.partial.length} have gaps shown as unavailable.</p>}
          <p>Snapshot exported {fetchedLabel(doc.exportedAt)}. Last observed hour here: {fetchedLabel(sensor.lastObserved)}. {expired && 'Forecast expired.'}</p>
          <p>Counts use observed prior-week patterns. Recent complete input is unavailable for the RNN/Transformer; this layer uses the seasonal fallback.</p>
          <p>Hourly weather: {doc.weatherSource}, retrieved {fetchedLabel(doc.weatherFetchedAt)}. Official BOM daily context issued {fetchedLabel(doc.bomIssuedAt)}. Weather is shared across the CBD.</p>
          <p><a href={doc.countsSource} target="_blank" rel="noreferrer">City of Melbourne pedestrian counts</a> · <a href={doc.weatherUrl} target="_blank" rel="noreferrer">Hourly weather source</a> · <a href="https://www.bom.gov.au/vic/forecasts/melbourne.shtml" target="_blank" rel="noreferrer">BOM Melbourne</a></p>
          <p>{doc.eventCoverage}</p>
          {doc.eventsFetchedAt && <p>Events checked {fetchedLabel(doc.eventsFetchedAt)} · <a href="https://whatson.melbourne.vic.gov.au/" target="_blank" rel="noreferrer">City of Melbourne What’s On</a> · <a href="https://fedsquare.com/events" target="_blank" rel="noreferrer">Fed Square</a></p>}
          {doc.sportsCoverage && <><p>{doc.sportsCoverage.coverage}</p>{doc.sportsCoverage.sources.map(s => <p key={s.provider}><a href={s.sourceUrl} target="_blank" rel="noreferrer">{s.name}</a> · {s.status === 'checked' && s.checkedAt ? `checked ${fetchedLabel(s.checkedAt)}` : 'source unavailable'}</p>)}</>}
        <p className="activity-caption activity-snapshot">Forecast snapshot · weather fetched {fetchedLabel(doc.weatherFetchedAt)}{expired ? ' · expired' : ''}</p>
        </details>
      </>}
      {doc && !sensor && <p>No forecast sensor lies within the existing CBD map.</p>}
      </div>
    </aside>
    {doc && sensor && time && w && <section ref={timebar} className="timebar activity-timebar" aria-label="Street activity time controls">
      <div className="timebar__dock activity-timebar__dock">
        <div className="activity-time-controls">
          <label className="activity-field">Date
            <select value={time.slice(0, 10)} onChange={e => {
              const next = hourOnDate(doc, e.target.value, Number(time.slice(11, 13)));
              if (next !== null) onTime(next);
            }}>{days.map(day => <option key={day} value={day}>{dateLabel(doc.times.find(t => t.startsWith(day))!)}</option>)}</select>
          </label>
          <label className="activity-field activity-slider">Forecast hour · {clock(time)}
            <input aria-label="Forecast hour" aria-valuetext={stamp(time)} type="range" min={firstHour} max={lastHour} step="1" value={Number(time.slice(11, 13))} onChange={e => {
              const next = hourOnDate(doc, time.slice(0, 10), Number(e.target.value));
              if (next !== null) onTime(next);
            }}/>
            <span className="activity-hour-scale" aria-hidden="true"><span>{String(firstHour).padStart(2, '0')}:00</span><span>{String(lastHour).padStart(2, '0')}:00</span></span>
          </label>
        </div>
        <div className="activity-time-summary" key={`${sensor.id}-${time}`}>
          <div className="activity-reading" aria-live="polite">
            <strong>{sensor.counts[i] === null ? 'Forecast unavailable' : <>{Math.round(sensor.counts[i]!).toLocaleString()} <small>movements / hour</small></>}</strong>
            <span>{sensor.counts[i] === null ? 'Insufficient matching observations' : `${sensor.activity[i]} for this location`} · {sensor.name}</span>
          </div>

        </div>
        <p className="activity-caption activity-time-note">Melbourne time · Slider stays on {dateLabel(time)} · Forecast through {stamp(doc.times.at(-1)!)}</p>
      </div>
    </section>}
  </>;
}
