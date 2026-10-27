import type { Project } from './futureCatalogue';
// Representative locations for orientation, not surveyed project boundaries.
export const anchors: Record<string, [number, number]> = {
  'central-city-urban-forest': [144.9631, -37.8136],
  'franklin-street': [144.9584, -37.8084],
  'greenline': [144.9740, -37.8190],
  'gurrowa-place': [144.9575, -37.8082],
  'melbourne-airport-rail': [144.8326, -37.7880],
  'state-library-overstation': [144.9630, -37.8098],
  'town-hall-overstation': [144.9671, -37.8174],
  'town-hall-finishing': [144.9690, -37.8178],
};
export type TimelineItem = { project: Project; label: string; detail: string; source: string; undated: boolean };
const yearOf = (date: string | null) => date ? Number(date.slice(0, 4)) : null;
export function timelineForYear(projects: Project[], year: number): TimelineItem[] {
  return projects.flatMap<TimelineItem>(project => {
    if (!anchors[project.id]) return [];
    if (project.id === 'central-city-urban-forest' && year >= 2025 && year <= 2035) {
      return [{ project, label: '2025–2035 plan', detail: 'Urban forest programme. This precinct marker does not assign individual tree planting to a particular year.', source: project.source_url, undated: false }];
    }
    const stages = project.stages.filter(stage => {
      const completed = yearOf(stage.actual_end);
      if (completed !== null) return completed === year;
      const start = yearOf(stage.planned_start);
      const end = yearOf(stage.planned_end);
      // An open-ended start is a milestone, not evidence of work in every later year.
      if (start !== null && end === null) return start === year;
      if (end !== null) return year >= (start ?? 2026) && year <= end;
      return false;
    });
    if (stages.length) return [{ project,
      label: stages.every(s => s.actual_end) ? 'Recorded milestone' : 'Published schedule',
      detail: stages.map(s => `${s.title}: ${s.actual_end ? `recorded completion ${s.actual_end}` : `${s.planned_start ? `planned start ${s.planned_start}` : 'reported underway in 2026'}${s.planned_end ? `; planned finish ${s.planned_end}` : '; finish date not confirmed'}`}. ${s.summary}`).join(' '),
      source: stages[0].source_url, undated: false }];
    const undated = project.stages.some(s => !s.actual_end && !s.planned_start && !s.planned_end) || !project.stages.length;
    return undated ? [{ project, label: 'Dates not confirmed', detail: project.summary, source: project.source_url, undated: true }] : [];
  });
}
