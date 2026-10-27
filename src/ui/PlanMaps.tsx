import { useEffect, useState } from 'react';
import { loadCatalogue, type PlanMap } from '../data/futureCatalogue';
import '../styles/plan-maps.css';

export function mapImageUrl(url: string): string {
  return url.startsWith('data/plan-maps/') ? `${import.meta.env.BASE_URL}${url}` : url;
}

export function PlanMaps({ maps = [] }: { maps?: PlanMap[] }) {
  if (!maps.length) return null;
  return <section className="plan-maps" aria-label="Official plan maps">
    <h3>See the plan on a map</h3>
    {maps.map(map => <MapFigure key={map.id} map={map} />)}
  </section>;
}

function MapFigure({ map }: { map: PlanMap }) {
  const [failed, setFailed] = useState(false);
  const image = mapImageUrl(map.image_url);
  return <figure className="plan-maps__figure">
    <h4>{map.title}</h4>
    {failed ? <p role="status">This map image could not load. You can view the published map in the original source below.</p>
      : <a className="plan-maps__image" href={image} target="_blank" rel="noopener noreferrer" aria-label={`Open ${map.title} full size`}>
        <img src={image} alt={map.alt_text} onError={() => setFailed(true)} />
      </a>}
    <figcaption><p>{map.caption}</p>
      <div className="plan-maps__links">{!failed && <a href={image} target="_blank" rel="noopener noreferrer">Open map full size ↗</a>}
        <a href={map.source_url} target="_blank" rel="noopener noreferrer">Map source: {map.publisher} ↗</a>
      </div>
    </figcaption>
  </figure>;
}

/** Original strategy conversations use the same API map records as project cards. */
export function LegacyPlanMaps({ planId }: { planId: string }) {
  const [maps, setMaps] = useState<PlanMap[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    setMaps([]);
    loadCatalogue(controller.signal).then(({ catalogue }) => {
      if (!controller.signal.aborted) setMaps((catalogue.maps ?? []).filter(m => m.plan_id === planId));
    }).catch(() => { /* Keep the conversation usable if no verified map loads. */ });
    return () => controller.abort();
  }, [planId]);
  return <PlanMaps maps={maps} />;
}
