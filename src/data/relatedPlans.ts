import type { Project } from './futureCatalogue';
export const strategyTopics = ['transport', 'public-space', 'urban-greening'];
export function relatedPlans(id: string, projects: Project[]) {
  const topics = id === 'transport' ? strategyTopics : projects.find(p => p.id === id)?.topics.map(t => t.id) ?? [];
  return projects.filter(p => p.id !== id && p.topics.some(t => topics.includes(t.id))).map(project => ({ project, shared: project.topics.filter(t => topics.includes(t.id)) }));
}
