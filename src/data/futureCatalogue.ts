export type Topic = { id: string; name: string; description: string };
export type News = { id: string; title: string; summary: string; source_url: string; published_on: string | null };
export type Stage = {
  id: string; title: string; status: string; summary: string; source_url: string;
  planned_start: string | null; planned_end: string | null;
  actual_start: string | null; actual_end: string | null;
};
export type PlanMap = { id: string; plan_id: string; title: string; image_url: string; caption: string; alt_text: string; source_url: string; publisher: string; verified_on: string };
export type ProjectAnswer = { question_id: string; title: string; body: string; source_url: string; source_title: string; verified_on: string };
export type Project = {
  id: string; title: string; summary: string; status: string; location: string;
  cbd_relevance: string; source_url: string; verified_on: string | null;
  topics: Topic[]; stages: Stage[]; news: News[]; answers: ProjectAnswer[]; maps?: PlanMap[];
};
export type Catalogue = { topics: Topic[]; projects: Project[]; news: News[]; maps?: PlanMap[] };
export type CatalogueResult = { catalogue: Catalogue; saved: boolean };

export function isCatalogue(value: unknown): value is Catalogue {
  if (!value || typeof value !== 'object') return false;
  const data = value as Catalogue;
  const topic = (t: Topic) => !!t && typeof t.id === 'string' && typeof t.name === 'string';
  const news = (n: News) => !!n && typeof n.id === 'string' && typeof n.title === 'string' && typeof n.summary === 'string' && safeSource(n.source_url);
  return (data.maps === undefined || (Array.isArray(data.maps) && data.maps.every(isPlanMap)))
    && Array.isArray(data.topics) && data.topics.every(topic)
    && Array.isArray(data.news) && data.news.every(news)
    && Array.isArray(data.projects) && data.projects.every(p => p && typeof p.id === 'string'
      && typeof p.title === 'string' && typeof p.summary === 'string' && typeof p.status === 'string'
      && typeof p.location === 'string' && typeof p.cbd_relevance === 'string' && safeSource(p.source_url)
      && (p.maps === undefined || (Array.isArray(p.maps) && p.maps.every(isPlanMap)))
      && Array.isArray(p.answers) && p.answers.every(a => a && typeof a.question_id === 'string'
        && typeof a.title === 'string' && typeof a.body === 'string' && a.body.trim().length >= 80 && safeSource(a.source_url))
      && Array.isArray(p.topics) && p.topics.every(topic)
      && Array.isArray(p.news) && p.news.every(news)
      && Array.isArray(p.stages) && p.stages.every(s => s && typeof s.id === 'string'
        && typeof s.title === 'string' && typeof s.status === 'string' && typeof s.summary === 'string' && safeSource(s.source_url)));
}
export function isPlanMap(map: PlanMap): boolean {
  return !!map && typeof map.id === 'string' && typeof map.plan_id === 'string'
    && typeof map.title === 'string' && typeof map.caption === 'string' && typeof map.alt_text === 'string'
    && typeof map.publisher === 'string' && safeSource(map.source_url)
    && typeof map.image_url === 'string' && (safeSource(map.image_url) || /^data\/plan-maps\/[a-zA-Z0-9._-]+\.(png|jpg)$/.test(map.image_url));
}
export function safeSource(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
export function filterProjects(projects: Project[], topic: string, query: string) {
  const term = query.trim().toLowerCase();
  return projects.filter(p => (!topic || p.topics.some(t => t.id === topic))
    && (!term || `${p.title} ${p.summary} ${p.location}`.toLowerCase().includes(term)));
}
export const statusLabel = (status: string) => ({
  unknown: 'Stage awaiting confirmation', approved: 'Approved', under_construction: 'Under construction',
  early_works: 'Early works', proposed: 'Proposed', consultation: 'Consultation', completed: 'Completed',
  planned: 'Planned', underway: 'Underway', paused: 'Paused', cancelled: 'Cancelled',
}[status] ?? status.replaceAll('_', ' '));

export async function loadCatalogue(signal: AbortSignal): Promise<CatalogueResult> {
  const configured = import.meta.env.VITE_FUTURE_API_URL as string | undefined;
  // Both local and hosted builds use the same-origin API, with a saved export
  // as a fallback when the backend is unavailable.
  const api = configured?.replace(/\/$/, '') ?? '/future-api';
  const read = async (url: string, timeout: number) => {
    const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]) });
    if (!response.ok) throw new Error('Project catalogue unavailable');
    const data: unknown = await response.json();
    if (!isCatalogue(data)) throw new Error('Invalid project catalogue');
    return data;
  };
  if (api) {
    try { return { catalogue: await read(`${api}/api/catalogue`, 4000), saved: false }; }
    catch (error) { if (signal.aborted) throw error; }
  }
  return { catalogue: await read(`${import.meta.env.BASE_URL}data/future-cbd.json`, 8000), saved: true };
}
