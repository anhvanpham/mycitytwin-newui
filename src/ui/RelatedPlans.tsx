import { useEffect, useState } from 'react';
import { loadCatalogue, type Project } from '../data/futureCatalogue';
import { relatedPlans, strategyTopics } from '../data/relatedPlans';
export function RelatedPlans({ id, projects, onExplore }: { id: string; projects: Project[]; onExplore: (id: string) => void }) {
  const related = relatedPlans(id, projects);
  const topics = projects.find(p => p.id === id)?.topics.map(t => t.id) ?? strategyTopics;
  const showStrategy = id !== 'transport' && topics.some(t => strategyTopics.includes(t));
  if (!related.length && !showStrategy) return null;
  return <div className="future-related"><h3>Connected topics</h3><p>Explore plans that share a theme. These links do not imply a joint delivery schedule.</p><div>
    {showStrategy && <button onClick={() => onExplore('transport')}><strong>Transport Strategy 2030</strong><span>Walking and people-focused streets</span></button>}
    {related.map(({project,shared}) => <button key={project.id} onClick={() => onExplore(project.id)}><strong>{project.title}</strong><span>{shared.map(t=>t.name).join(' · ')}</span></button>)}
  </div></div>;
}
export function LoadedRelatedPlans({ id, onExplore }: { id: string; onExplore: (id: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => { const controller=new AbortController();loadCatalogue(controller.signal).then(r=>setProjects(r.catalogue.projects)).catch(()=>{});return()=>controller.abort(); }, []);
  return <RelatedPlans id={id} projects={projects} onExplore={onExplore} />;
}
