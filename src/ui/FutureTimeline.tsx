import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map as LibreMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { loadCatalogue, type CatalogueResult } from '../data/futureCatalogue';
import { anchors, timelineForYear } from '../data/futureTimeline';
import { cellAt, contextAdvice, loadSpatialContext, type Cell, type SpatialContext } from '../data/futureContext';
import { CLUSTERS, TREE_SOURCE, softenMap, showContext, type ContextView } from '../data/futureMapLayers';
import coverage from '../data/city-coverage-summary.json';
import { frameHoddleGrid, setHoddleGridFocus } from '../data/hoddleGridMap';
import { CITY_VIEW_BOUNDS, futureMapAreas, projectInMapArea, projectMapBounds, type FutureMapArea } from '../data/futureMapArea';
import type { CityModel } from '../data/model';
import '../styles/future-timeline.css';

setWorkerUrl(workerUrl);
const views: { id: ContextView; label: string }[] = [
  { id: 'projects', label: 'Projects' }, { id: 'trees', label: 'Trees' }, { id: 'buildings', label: 'Buildings' },
];
export function FutureTimeline({ onExplore }: { onExplore: (id: string) => void; mapExtent?: CityModel['extent'] }) {
  const [year, setYear] = useState(2027);
  const [result, setResult] = useState<CatalogueResult | null>(null);
  const [showUndated, setShowUndated] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<ContextView>('projects');
  const [area, setArea] = useState<FutureMapArea>('city');
  const [context, setContext] = useState<SpatialContext | null>(null);
  const [contextError, setContextError] = useState('');
  const [block, setBlock] = useState<Cell | null>(null);
  const [noBlock, setNoBlock] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState('');
  const all = useMemo(() => timelineForYear(result?.catalogue.projects ?? [], year), [result, year]);
  const items = useMemo(() => all.filter(item => !item.undated || showUndated), [all, showUndated]);
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const current = useRef({ view, context, area, items });
  useEffect(() => { current.current = { view, context, area, items }; }, [view, context, area, items]);

  useEffect(() => {
    const controller = new AbortController();
    loadCatalogue(controller.signal).then(setResult).catch(() => {
      if (!controller.signal.aborted) setError('Plans could not be loaded.');
    });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (view === 'projects' || context) return;
    const controller = new AbortController();
    loadSpatialContext(controller.signal).then(setContext).catch(() => {
      if (!controller.signal.aborted) setContextError('City context could not load. Try another map view and come back.');
    });
    return () => controller.abort();
  }, [view, context]);
  useEffect(() => {
    if (!host.current) return;
    try {
      const instance = new LibreMap({ container: host.current, style: 'https://tiles.openfreemap.org/styles/liberty', bounds: CITY_VIEW_BOUNDS, minZoom: 10, maxZoom: 18, fitBoundsOptions: { padding: 24 }, pitch: 0, dragRotate: false, touchPitch: false, renderWorldCopies: false });
      map.current = instance;
      instance.touchZoomRotate.disableRotation();
      instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      instance.on('load', () => { softenMap(instance); setHoddleGridFocus(instance, current.current.area === 'grid'); instance.once('idle',()=>setMapReady(true)); });
      instance.on('error', () => setError('Some map tiles could not load. Project details remain available below.'));
      instance.on('click', async event => {
        const { view: mode, context: data, area: mapArea } = current.current;
        if (mode === 'projects' || !data || (mapArea === 'grid' && !projectInMapArea([event.lngLat.lng, event.lngLat.lat], 'grid'))) return;
        if (mode === 'trees' && instance.getLayer(CLUSTERS)) {
          const cluster = instance.queryRenderedFeatures(event.point, { layers: [CLUSTERS] })[0];
          if (cluster?.geometry.type === 'Point') {
            const source = instance.getSource(TREE_SOURCE) as GeoJSONSource;
            try {
              const zoom = await source.getClusterExpansionZoom(Number(cluster.properties.cluster_id));
              if (map.current === instance) instance.easeTo({ center: cluster.geometry.coordinates as [number, number], zoom, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350 });
            } catch { /* A layer removed while a cluster expands needs no user error. */ }
            return;
          }
        }
        const picked = cellAt(data, [event.lngLat.lng, event.lngLat.lat]);
        setBlock(picked); setNoBlock(!picked);
      });
      const observer = new ResizeObserver(() => {
        instance.resize();
        if (current.current.area === 'grid') frameHoddleGrid(instance);
        else if (current.current.area === 'all') instance.fitBounds(projectMapBounds(current.current.items.map(item=>anchors[item.project.id])), { padding: 36, duration: 0 });
      });
      observer.observe(host.current);
      return () => { observer.disconnect(); instance.remove(); map.current = null; setMapReady(false); };
    } catch {
      // An external constructor can fail before its asynchronous error events exist.
      // oxlint-disable-next-line react/set-state-in-effect
      setError('The map is unavailable on this device. Explore the project details below.');
    }
  }, []);
  useEffect(() => {
    if (mapReady && map.current && context) {
      showContext(map.current, context, view, block?.id ?? null);
      setHoddleGridFocus(map.current, area === 'grid');
    }
  }, [mapReady, context, view, block, area]);


  const frameArea = useCallback((instance: LibreMap, nextArea: FutureMapArea) => {
    instance.stop();
    if (nextArea === 'grid') frameHoddleGrid(instance);
    else {
      instance.setMaxBounds(null);
      instance.setMinZoom(10);
      const points=current.current.items.map(item=>anchors[item.project.id]);
      instance.fitBounds(nextArea === 'all' ? projectMapBounds(points) : CITY_VIEW_BOUNDS, { padding: 36, duration: 0 });
    }
    setHoddleGridFocus(instance, nextArea === 'grid');
  }, []);
  useEffect(() => {
    if (mapReady && map.current) frameArea(map.current, area);
  }, [mapReady, area, frameArea]);
  useEffect(() => {
    if (mapReady && map.current && area === 'all' && !selected) frameArea(map.current, area);
  }, [mapReady, area, items, selected, frameArea]);
  useEffect(() => {
    if (mapReady && map.current && selected) map.current.flyTo({ center: anchors[selected], zoom: 15, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500 });
  }, [mapReady, area, selected]);
  const focusProject = useCallback((id: string) => {
    setSelected(id); setBlock(null); setNoBlock(false);
    if (!projectInMapArea(anchors[id], area)) setArea(projectInMapArea(anchors[id], 'city') ? 'city' : 'all');
    onExplore(id);
  }, [onExplore, area]);
  useEffect(() => {
    markers.current.forEach(marker => marker.remove());
    markers.current = [];
    if (!map.current) return;
    items.forEach((item, index) => {
      if (!projectInMapArea(anchors[item.project.id], area)) return;
      const button = document.createElement('button');
      button.className = `future-timeline__pin${item.undated ? ' future-timeline__pin--undated' : ''}`;
      button.textContent = String(index + 1);
      button.title = item.project.title;
      button.setAttribute('aria-label', `${item.project.title}: ${item.label}`);
      button.setAttribute('aria-pressed', String(item.project.id === selected));
      button.onclick = event => { event.stopPropagation(); focusProject(item.project.id); };
      markers.current.push(new Marker({ element: button }).setLngLat(anchors[item.project.id]).addTo(map.current!));
    });
    return () => { markers.current.forEach(marker => marker.remove()); };
  }, [mapReady, items, selected, focusProject, area]);
  const changeView = (next: ContextView) => { setView(next); setContextError(''); setBlock(null); setNoBlock(false); };
  const changeYear = (next: number) => { setYear(next); setSelected(null); };
  const changeArea = (next: FutureMapArea) => { setArea(next); setSelected(null); setBlock(null); setNoBlock(false); };
  const resetMap = () => { setSelected(null); if (map.current) frameArea(map.current, area); };

  return <section className="future-timeline" aria-labelledby="timeline-title">
    <div className="future-timeline__heading"><div>
      <p className="future-plans__eyebrow">Explore the city through time</p>
      <h2 id="timeline-title">What could change in {year}?</h2>
      <p>Choose a year, then a project to start a conversation.</p>
    </div></div>
    <div className="future-timeline__controls">
      <button aria-label="Previous year" disabled={year === 2025} onClick={() => changeYear(year - 1)}>←</button>
      <label htmlFor="future-year"><strong>{year}</strong></label>
      <input id="future-year" aria-label="Project year" type="range" min="2025" max="2035" step="1" value={year} onChange={event => changeYear(Number(event.target.value))} />
      <button aria-label="Next year" disabled={year === 2035} onClick={() => changeYear(year + 1)}>→</button>
    </div>
    <div className="future-timeline__toolbar">
      <div className="future-timeline__views" role="group" aria-label="Map view">
        {views.map(mode => <button key={mode.id} aria-pressed={view === mode.id} onClick={() => changeView(mode.id)}><i className={`future-timeline__view-icon future-timeline__view-icon--${mode.id}`} aria-hidden="true" />{mode.label}</button>)}
      </div>
      <div className="future-timeline__map-tools">{view !== 'projects' && <span className="future-timeline__baseline">Recorded baseline</span>}<label className="future-timeline__area" htmlFor="future-map-area">Area<select id="future-map-area" aria-label="Map area" value={area} onChange={event => changeArea(event.target.value as FutureMapArea)}>{futureMapAreas.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label><button className="future-timeline__city-reset" aria-label="Reset map view" onClick={resetMap}>Reset view ⟲</button></div>
    </div>
    <div className="future-timeline__map-wrap">
      <div ref={host} className={`future-timeline__map${mapReady ? '' : ' future-timeline__map--loading'}`} aria-label={`${views.find(mode => mode.id === view)?.label} map with project locations for ${year}`} />
      {!mapReady && !error && <span className="future-timeline__map-status" role="status">Loading the map…</span>}
      {mapReady && view !== 'projects' && !context && !contextError && <span className="future-timeline__map-status" role="status">Loading city context…</span>}
    </div>
    <div className="future-timeline__legend" aria-live="polite">
      {view === 'projects' && <span>Numbered pins match the projects below.</span>}
      {view === 'trees' && <><span><i className="future-timeline__tree-key" />Recorded trees</span><span>Tap a group to zoom in.</span></>}
      {view === 'buildings' && <><span className="future-timeline__scale">Less <i /> More building coverage</span><span>Tap a block for details.</span></>}
    </div>
    {(error || contextError) && <p className="future-timeline__note" role="status">{error || contextError}</p>}
    {noBlock && <p className="future-timeline__note" role="status">No complete block sample here. This doesn’t mean there are no trees or buildings.</p>}
    {block && context && view !== 'projects' && <article className="future-timeline__block" aria-live="polite">
      <div className="future-timeline__block-heading"><h3>A closer look at this block</h3><button aria-label="Close block details" onClick={() => setBlock(null)}>×</button></div>
      <dl><div><dt>Building coverage</dt><dd>{block.coverage}%</dd></div><div><dt>Recorded trees</dt><dd>{block.trees}</dd></div><div><dt>Sample area</dt><dd>200 × 200 m</dd></div></dl>
      <p>{contextAdvice(block, context)}</p>
      <div className="future-timeline__block-links"><button onClick={() => onExplore('central-city-urban-forest')}>Explore the urban forest plan ↗</button><button onClick={() => onExplore('transport')}>Explore walking and transport ↗</button></div>
    </article>}
    <div className="future-timeline__list" aria-label={`Projects in ${year}`}>
      {items.map((item, index) => <button key={item.project.id} aria-pressed={selected === item.project.id} onClick={() => focusProject(item.project.id)} aria-label={`Open conversation about ${item.project.title}`}>
        <span className={`future-timeline__number${item.undated ? ' future-timeline__number--undated' : ''}`} aria-hidden="true">{index + 1}</span>
        <span className="future-timeline__card-copy"><strong>{item.project.title}</strong><span>{item.label}</span>{!projectInMapArea(anchors[item.project.id], area) && <span>Outside {futureMapAreas.find(option=>option.id === area)?.label} · opens wider view</span>}<span className="future-timeline__card-action">Open conversation ↗</span></span>
      </button>)}
      {!result && !error && <p role="status">Loading project schedules…</p>}
      {result && !items.length && <p>No dated milestones in the reviewed records for this year.</p>}
    </div>
    <label className="future-timeline__toggle"><input type="checkbox" checked={showUndated} onChange={event => setShowUndated(event.target.checked)} /> Show projects with unconfirmed dates ({all.filter(item => item.undated).length})</label>
    <details className="future-timeline__method"><summary>About this map & sources</summary>
      <p>Planned dates do not confirm completion. Pins show representative locations, not project boundaries. The map opens across the CBD and fringe. Choose Hoddle Grid for a focused view, or All projects to include locations farther away. You can pan and zoom across the wider city. Selecting a project outside the current area opens a wider view and its conversation. {result?.saved && 'Using saved project records.'}</p>
      <p>The year changes project schedules. Trees and building coverage stay as recorded baselines; they do not simulate future planting or buildings. Coverage measures mapped footprint area, not population, height or canopy.</p>
      <p>Building footprints: May 2023. {context && `Tree inventory retrieved ${new Date(context.sources.treesRetrievedAt).toLocaleDateString('en-AU')}. `}Whole 200 m blocks are sampled every 5 m. Advice is exploratory and needs a site assessment.</p>
      <a href={coverage.sourceUrl} target="_blank" rel="noopener noreferrer">Council building data ↗</a>
      <a href="https://data.melbourne.vic.gov.au/explore/dataset/trees-with-species-and-dimensions-urban-forest/" target="_blank" rel="noopener noreferrer">Council tree data ↗</a>
    </details>
  </section>;
}
