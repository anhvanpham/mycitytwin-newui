import { useEffect, useRef, useState } from 'react';
import {
  PLANS, PLAN_QUESTIONS, PLAN_REPLIES, PLAN_SOURCES, appendPlanQuestion,
  type PlanId, type QuestionId,
} from '../data/futurePlans';
import '../styles/future-plans.css';

export function FuturePlansPage({ onHome, onFutureWork, reducedMotion }: {
  onHome: () => void;
  onFutureWork: () => void;
  reducedMotion: boolean;
}) {
  const [selected, setSelected] = useState<PlanId | null>(null);
  const [histories, setHistories] = useState<Record<PlanId, QuestionId[]>>({ greenline: [], transport: [] });
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const plan = PLANS.find(item => item.id === selected);
  const history = selected ? histories[selected] : [];

  useEffect(() => {
    root.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [selected]);

  useEffect(() => {
    if (!history.length) return;
    thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
    if (window.matchMedia('(max-width: 760px)').matches) {
      thread.current?.closest('.future-plans__chat')?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  }, [history, reducedMotion]);

  const ask = (question: QuestionId) => {
    if (!selected) return;
    if (history.includes(question)) {
      const answer = thread.current?.querySelector<HTMLElement>(`[data-answer="${question}"]`);
      answer?.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
      answer?.focus({ preventScroll: true });
      return;
    }
    setHistories(previous => ({ ...previous, [selected]: appendPlanQuestion(previous[selected], question) }));
  };

  return (
    <section className="future-plans" ref={root} aria-labelledby="future-page-title">
      <header className="future-plans__header">
        <button className="future-plans__brand" onClick={onHome} aria-label="My City Twin — home">
          <svg width="25" height="25" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <path d="M4 22V9l6-3v3l6-3v16H4Zm12-11 6 3v8h-6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
          <span>My City Twin</span>
        </button>
        <nav aria-label="Future plans navigation">
          <button className="future-plans__home" onClick={onHome}>← Home</button>
          <button className="future-plans__home" onClick={onFutureWork}>Future work</button>
          <span className="future-plans__current" aria-current="page">Future plans</span>
        </nav>
      </header>

      <div className="future-plans__inner">
        <div className="future-plans__intro">
          <div>
            <p className="future-plans__eyebrow">{plan ? 'A little city conversation' : 'Melbourne CBD · Future plans'}</p>
            <h1 id="future-page-title" ref={heading} tabIndex={-1}>
              {plan ? plan.title : 'A changing city. Your everyday questions.'}
            </h1>
            <p className="future-plans__lede">{plan ? plan.summary : 'Choose a plan. Ask what it could mean for your day.'}</p>
            {plan && <button className="future-plans__back" onClick={() => setSelected(null)}>← Choose another plan</button>}
          </div>
          <PlanArt transport={selected === 'transport'} />
        </div>

        {!plan ? (
          <>
            <section aria-labelledby="choose-plan-title">
              <h2 className="future-plans__section-label" id="choose-plan-title">Explore a plan</h2>
              <div className="future-plans__projects">
                {PLANS.map(item => (
                  <button key={item.id} className={`future-plans__project future-plans__project--${item.id}`}
                    onClick={() => setSelected(item.id)} aria-label={`Explore ${item.title}`}>
                    <span className="future-plans__status">{item.status}</span>
                    <strong>{item.title}</strong>
                    <span>{item.prompt}</span>
                    <span className="future-plans__project-action">Open a conversation <span aria-hidden="true">↗</span></span>
                  </button>
                ))}
              </div>
            </section>
            <section className="future-plans__how" aria-labelledby="conversation-how-title">
              <h2 id="conversation-how-title">Your questions. One conversation.</h2>
              <ol>
                <li><span>01</span><h3>Pick a plan</h3><p>Start with the changes you’re curious about.</p></li>
                <li><span>02</span><h3>Choose a question</h3><p>Your commute? A shadier street? Pick what matters to you.</p></li>
                <li><span>03</span><h3>Keep exploring</h3><p>Read the reply and its sources, then ask another question.</p></li>
              </ol>
            </section>
          </>
        ) : (
          <div className="future-plans__conversation" key={plan.id}>
            <section className="future-plans__chat" aria-labelledby="conversation-title">
              <div className="future-plans__chat-heading">
                <h2 id="conversation-title">Your conversation</h2>
                <span>Guided questions</span>
              </div>
              <div className="future-plans__thread" ref={thread} role="log" aria-live="polite" aria-relevant="additions" aria-label={`Conversation about ${plan.title}`} tabIndex={0}>
                <div className="future-plans__reply future-plans__greeting">
                  <span className="future-plans__speaker">My City Twin</span>
                  <p>{plan.greeting}</p>
                </div>
                {history.map(id => {
                  const question = PLAN_QUESTIONS.find(item => item.id === id)!;
                  const reply = PLAN_REPLIES[plan.id][id];
                  return (
                    <div className="future-plans__exchange" key={id}>
                      <div className="future-plans__question"><span className="future-plans__speaker">You</span><p>{question.label}</p></div>
                      <article className="future-plans__reply" data-answer={id} tabIndex={-1}
                        aria-labelledby={`answer-${plan.id}-${id}`}>
                        <span className="future-plans__speaker">My City Twin</span>
                        <h3 id={`answer-${plan.id}-${id}`}>{reply.title}</h3>
                        <p>{reply.body}</p>
                        <div className="future-plans__consider"><strong>A closer look</strong><p>{reply.consider}</p></div>
                        <p className="future-plans__limit">{reply.limit}</p>
                        <div className="future-plans__sources"><strong>Plan sources</strong>
                          {reply.sources.map(source => <a key={source} href={PLAN_SOURCES[source].href} target="_blank" rel="noopener noreferrer">{PLAN_SOURCES[source].title}<span aria-hidden="true"> ↗</span><span className="future-plans__sr"> (opens in a new tab)</span></a>)}
                        </div>
                      </article>
                    </div>
                  );
                })}
              </div>
              <p className="future-plans__chat-hint">{history.length ? 'Keep the conversation going. Choose another question.' : 'Your first question starts here. Choose one from the list.'}</p>
            </section>
            <aside className="future-plans__questions" aria-labelledby="question-list-title">
              <h2 id="question-list-title">What’s on your mind?</h2>
              <p>Eight everyday questions. Start anywhere.</p>
              <div>
                {PLAN_QUESTIONS.map(question => (
                  <button key={question.id} onClick={() => ask(question.id)}>
                    <span>{question.label}</span><span className="future-plans__question-mark" aria-hidden="true">{history.includes(question.id) ? '↩' : '+'}</span>
                    {history.includes(question.id) && <span className="future-plans__sr"> — revisit answer</span>}
                  </button>
                ))}
              </div>
              {history.length > 0 && <button className="future-plans__reset" onClick={() => setHistories(previous => ({ ...previous, [plan.id]: [] }))}>Start this conversation again</button>}
            </aside>
          </div>
        )}

        <footer className="future-plans__footer">
          <div><strong>Possible effects, not promises.</strong><p>These guides explain what to consider. They don’t calculate prices, rent, travel times or local conditions.</p></div>
          <span>Based on council plans · Guided prototype</span>
        </footer>
      </div>
    </section>
  );
}

/** A small illustration drawn in the page’s own design language. */
function PlanArt({ transport }: { transport: boolean }) {
  return (
    <svg className="future-plans__art" viewBox="0 0 240 150" fill="none" aria-hidden="true">
      <ellipse cx="128" cy="129" rx="99" ry="14" fill="#d5e9e2" />
      <circle cx="191" cy="24" r="13" fill="#f0d29a" />
      {transport ? <>
        <rect x="53" y="47" width="129" height="62" rx="16" fill="#f3d8c9" stroke="#456d66" strokeWidth="2.5" />
        <path d="M71 62h92v23H71zM84 109v14m68-14v14M39 125h153" stroke="#456d66" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="80" cy="98" r="4" fill="#456d66" /><circle cx="158" cy="98" r="4" fill="#456d66" />
      </> : <>
        <path d="M31 122c29-21 53-12 84-2s62 23 97-1" stroke="#456d66" strokeWidth="3" strokeLinecap="round" />
        <path d="M158 62v55M158 76l-24-20m24 6 25-18" stroke="#456d66" strokeWidth="2.5" />
        <circle cx="160" cy="49" r="27" fill="#add6c4" stroke="#456d66" strokeWidth="2.5" />
        <circle cx="135" cy="70" r="24" fill="#baddce" stroke="#456d66" strokeWidth="2.5" />
        <circle cx="185" cy="68" r="23" fill="#baddce" stroke="#456d66" strokeWidth="2.5" />
        <rect x="69" y="52" width="34" height="62" rx="8" fill="#f3d8c9" stroke="#456d66" strokeWidth="2.5" />
        <path d="M79 67h14m-14 14h14m-14 14h14" stroke="#456d66" strokeWidth="2.5" strokeLinecap="round" />
      </>}
    </svg>
  );
}
