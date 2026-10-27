import { useEffect, useRef, useState, type ReactNode } from 'react';
import { loadCatalogue, statusLabel, type CatalogueResult, type Project } from '../data/futureCatalogue';
import '../styles/future-catalogue.css';
import { RelatedPlans } from './RelatedPlans';

const QUESTIONS = [
  { id: 'overview', label: 'What is this plan about?' },
  { id: 'location', label: 'Where is it, and how does it connect to the CBD?' },
  { id: 'stages', label: 'What has been built, and what comes next?' },
  { id: 'timing', label: 'When could these changes happen?' },
  { id: 'news', label: 'Are there any related updates?' },
  { id: 'sources', label: 'Where can I read the original plan?' },
] as const;
type QuestionId = typeof QUESTIONS[number]['id'];

export function FutureProjectCatalogue({ children, selected, onSelect, onExplore }: { children?: ReactNode; selected: string | null; onSelect: (id: string | null) => void; onExplore: (id: string) => void }) {
  const [result, setResult] = useState<CatalogueResult | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [histories, setHistories] = useState<Record<string, QuestionId[]>>({});
  const details = useRef<HTMLHeadingElement>(null);
  const catalogueRoot = useRef<HTMLElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    loadCatalogue(controller.signal).then(data => { if (!controller.signal.aborted) setResult(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  const catalogue = result?.catalogue;
  const project = catalogue?.projects.find(p => p.id === selected);
  useEffect(() => {
    if (!project) return;
    details.current?.focus({ preventScroll: true });
    catalogueRoot.current?.querySelector<HTMLElement>('.future-catalogue__conversation')?.scrollIntoView({ block: 'start' });
  }, [project?.id]);
  const history = selected ? histories[selected] ?? [] : [];
  useEffect(() => {
    if (!history.length) return;
    thread.current?.scrollTo({ top: thread.current.scrollHeight });
    if (window.matchMedia('(max-width: 760px)').matches) {
      thread.current?.closest('.future-plans__chat')?.scrollIntoView({ block: 'start' });
    }
  }, [history]);
  const ask = (id: QuestionId) => {
    if (!selected) return;
    if (history.includes(id)) {
      thread.current?.querySelector<HTMLElement>(`[data-answer="${id}"]`)?.focus();
      return;
    }
    setHistories(previous => ({ ...previous, [selected]: [...history, id] }));
  };
  return <section className="future-catalogue" ref={catalogueRoot} aria-labelledby="catalogue-title">
    <div className="future-catalogue__heading">
      <div><p className="future-plans__eyebrow">{project ? 'A little city conversation' : 'Explore a plan'}</p>
        <h2 id="catalogue-title" ref={details} tabIndex={-1}>{project ? project.title : 'Which change are you curious about?'}</h2>
        <p>{project ? project.summary : 'Choose a plan, then pick a question to explore what’s changing.'}</p></div>
    </div>
    {result?.saved && <p className="future-catalogue__note">Showing saved plans. Check the original sources for the latest updates.</p>}
    {error ? <div role="alert"><p>We couldn’t load the plans. Please try again.</p><button onClick={() => setAttempt(a => a + 1)}>Try again</button></div>
      : !catalogue ? <p role="status">Loading city plans…</p>
      : project ? <>
        <button className="future-plans__back" onClick={() => { onSelect(null); requestAnimationFrame(() => catalogueRoot.current?.querySelector<HTMLButtonElement>(`[data-project="${project.id}"]`)?.focus()); }}>← Choose another plan</button>
        <RelatedPlans id={project.id} projects={catalogue.projects} onExplore={onExplore} />
        <div className="future-plans__conversation future-catalogue__conversation">
          <section className="future-plans__chat" aria-labelledby="project-conversation-title">
            <div className="future-plans__chat-heading"><h3 id="project-conversation-title">Your conversation</h3><span>Guided questions</span></div>
            <div className="future-plans__thread" ref={thread} role="log" aria-live="polite" aria-relevant="additions" aria-label={`Conversation about ${project.title}`} tabIndex={0}>
              <div className="future-plans__reply future-plans__greeting"><span className="future-plans__speaker">My City Twin</span><p>Let’s explore {project.title}. What would you like to know about the plan?</p></div>
              {history.map(id => <div className="future-plans__exchange" key={id}>
                <div className="future-plans__question"><span className="future-plans__speaker">You</span><p>{QUESTIONS.find(q => q.id === id)!.label}</p></div>
                <article className="future-plans__reply" data-answer={id} tabIndex={-1} aria-label={`Answer: ${QUESTIONS.find(q => q.id === id)!.label}`}>
                  <span className="future-plans__speaker">My City Twin</span><PlanAnswer project={project} question={id} />
                </article>
              </div>)}
            </div>
            <p className="future-plans__chat-hint">Choose a question to keep exploring.</p>
          </section>
          <aside className="future-plans__questions" aria-labelledby="project-questions-title">
            <h3 id="project-questions-title">What’s on your mind?</h3><p>Start with what matters to you.</p>
            <div>{QUESTIONS.map(q => <button key={q.id} onClick={() => ask(q.id)}><span>{q.label}</span><span className="future-plans__question-mark" aria-hidden="true">{history.includes(q.id) ? '↩' : '+'}</span>{history.includes(q.id) && <span className="future-plans__sr"> — revisit answer</span>}</button>)}</div>
            {history.length > 0 && <button className="future-plans__reset" onClick={() => setHistories(p => ({ ...p, [project.id]: [] }))}>Start this conversation again</button>}
          </aside>
        </div>
      </> : <div className="future-plans__projects">{catalogue.projects.map(p => <button key={p.id} data-project={p.id}
        className={`future-plans__project ${p.topics.some(t => t.id === 'transport' || t.id === 'buildings') ? 'future-plans__project--transport' : ''}`}
        onClick={() => onSelect(p.id)} aria-label={`Explore ${p.title}`}>
        <span className="future-plans__status">{statusLabel(p.status)}</span><strong>{p.title}</strong>
        <span>{p.location}</span><span className="future-plans__project-action">Open a conversation <span aria-hidden="true">↗</span></span>
      </button>)}{children}</div>}
  </section>;
}

export function PlanAnswer({ project, question }: { project: Project; question: QuestionId }) {
  const answer = project.answers.find(item => item.question_id === question);
  const dates = project.stages.filter(s => s.planned_start || s.planned_end || s.actual_start || s.actual_end);
  return <>
    <h4>{answer?.title ?? 'What we know about this plan'}</h4>
    <p className="future-catalogue__answer-body">{answer?.body ?? `${project.summary} This record does not yet contain a reviewed answer to this particular question. We cannot confirm further details from the current record.`}</p>
    {question === 'stages' && project.stages.length > 0 && <ol className="future-catalogue__stages">{project.stages.map(s => <li key={s.id}>
      <span className="future-plans__status">{statusLabel(s.status)}</span><h5>{s.title}</h5><p>{s.summary}</p>
    </li>)}</ol>}
    {question === 'timing' && dates.map(s => <div key={s.id}><h5>{s.title}</h5>
      <div className="future-catalogue__dates">{s.planned_start && <span>Planned start: {s.planned_start}</span>}{s.planned_end && <span>Planned finish: {s.planned_end}</span>}{s.actual_start && <span>Started: {s.actual_start}</span>}{s.actual_end && <span>Completed: {s.actual_end}</span>}</div>
    </div>)}
    <div className="future-plans__sources"><strong>Supporting source</strong>
      <a href={answer?.source_url ?? project.source_url} target="_blank" rel="noopener noreferrer">{answer?.source_title ?? 'Project source'} ↗<span className="future-plans__sr"> (opens in a new tab)</span></a>
      {answer && answer.source_url !== project.source_url && <a href={project.source_url} target="_blank" rel="noopener noreferrer">Project overview ↗</a>}
    </div>
    <p className="future-plans__limit">Source checked: {answer?.verified_on ?? project.verified_on ?? 'Not yet confirmed'}.</p>
  </>;
}
