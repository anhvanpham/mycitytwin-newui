import { useEffect, useRef } from 'react';
import '../styles/future-plans.css';
import '../styles/future-work.css';

const WORK = [
  {
    label: '01 / More plans', title: 'Follow the change.',
    body: 'See the story behind a proposed development, from its planning documents to its current stage. We want to bring updates together so you can understand what may change near you.',
  },
  {
    label: '02 / Your everyday life', title: 'Make it personal.',
    body: 'Explore change through the places you use every day: your walk to work, a favourite park or the street outside your home. We’re looking at ways to make walking, access and public space easier to compare.',
  },
  {
    label: '03 / Better evidence', title: 'Compare with confidence.',
    body: 'Understand where the information comes from and what each comparison can tell you. We plan to improve data checks, explain the model’s assumptions and make uncertainty easier to see.',
  },
];

export function FutureWorkPage({ onHome, onFuturePlans }: {
  onHome: () => void;
  onFuturePlans: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  return (
    <section className="future-plans future-work" aria-labelledby="future-work-title">
      <header className="future-plans__header">
        <button className="future-plans__brand" onClick={onHome} aria-label="My City Twin — home">
          <svg width="25" height="25" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <path d="M4 22V9l6-3v3l6-3v16H4Zm12-11 6 3v8h-6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
          <span>My City Twin</span>
        </button>
        <nav aria-label="Future work navigation">
          <button className="future-plans__home" onClick={onHome}>← Home</button>
          <button className="future-plans__home" onClick={onFuturePlans}>Future plans</button>
          <span className="future-plans__current" aria-current="page">Future work</span>
        </nav>
      </header>
      <div className="future-plans__inner">
        <div className="future-work__intro">
          <p className="future-plans__eyebrow">Future work</p>
          <h1 id="future-work-title" ref={heading} tabIndex={-1}>More to come.</h1>
          <p className="future-plans__lede">We’re exploring new ways to help you understand how Melbourne is changing. These features are planned for future versions.</p>
        </div>
        <ol className="future-work__cards" aria-label="Planned features">
          {WORK.map(item => (
            <li key={item.label}>
              <p className="future-plans__eyebrow">{item.label}</p>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </li>
          ))}
        </ol>
        <footer className="future-work__footer">Your city. Your everyday life.</footer>
      </div>
    </section>
  );
}
