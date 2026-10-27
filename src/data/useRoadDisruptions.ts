import { useCallback, useEffect, useRef, useState } from 'react';
import { type RoadDoc, type RoadFeed, REFRESH_SECONDS, ROAD_SOURCES } from './roadDisruptions';

function validDoc(value: unknown): value is RoadDoc {
  if (!value || typeof value !== 'object') return false;
  const doc = value as RoadDoc;
  return doc.schemaVersion === 1 && Array.isArray(doc.feeds) && doc.feeds.length === 2 &&
    ['planned', 'unplanned'].every(kind => doc.feeds.filter(f => f.kind === kind).length === 1) &&
    doc.feeds.every(f => ['ready', 'unconfigured', 'unavailable'].includes(f.status) && Array.isArray(f.notices) &&
      f.sourceUrl === ROAD_SOURCES[f.kind] && f.refreshSeconds === REFRESH_SECONDS[f.kind] &&
      (f.status !== 'ready' || (typeof f.checkedAt === 'string' && Number.isFinite(Date.parse(f.checkedAt)))));
}
export function useRoadDisruptions() {
  const [doc, setDoc] = useState<RoadDoc | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller; setLoading(true);
    try {
      const response = await fetch('/road-disruptions-api', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Road feed unavailable');
      const next: unknown = await response.json();
      if (!validDoc(next)) throw new Error('Unexpected road feed');
      if (!controller.signal.aborted) { setDoc(next); setError(false); }
    } catch {
      if (!controller.signal.aborted) { setError(true); setDoc(null); }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(visibleRefresh, 60000);
    document.addEventListener('visibilitychange', visibleRefresh);
    return () => { active.current?.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visibleRefresh); };
  }, [refresh]);
  return { doc, error, loading, refresh };
}
export function findRoadFeed(doc: RoadDoc | null, kind: RoadFeed['kind']) { return doc?.feeds.find(f => f.kind === kind); }
