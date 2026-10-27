/**
 * Local landing redesign: the live city sits beside address search, with
 * five feature entry points and a compact footer. The map window reports
 * its bounds to ViewInset; sources and background remain accessible below.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { bundled } from '../data/bundled';
import type { LoadProgress } from '../data/useCityModel';
import type { ScreenInset } from '../scene/ViewInset';
import { SourcesLink } from './Sources';
import { LandingMore } from './LandingMore';
import { LANDING_FEATURES, LandingFeatureIcon, type LandingFeature } from './LandingFeatures';
import { useLandingReveal } from './useLandingReveal';
import '../styles/landing.css';
import '../styles/landing-reference.css';

/**
 * How much of the city's window must stay clear of the header for the map
 * credit inside it still to be seen: the credit's own height and the gap
 * under it, with a little to spare. Pixels.
 */
const CREDIT_ROOM = 72;

/** The id "How it works" in the header moves to. */
export const HOW_IT_WORKS_ID = 'how-it-works';

/** The front page, over the city, with a window cut in it for the city. */
export function LandingPage({
  query,
  onQuery,
  onSearchFocus,
  results,
  chosen,
  onClearChosen,
  onSunlight,
  onExplore,
  onEnterVr,
  loading,
  when,
  credit,
  onInset,
  reducedMotion,
  onFeature,
  modelSummary,
  onFuturePlans,
}: {
  /** The text in the search field — App's, shared with the header's field. */
  onFeature: (feature: LandingFeature) => void;
  modelSummary: { buildings: number; developments: number; source: 'live' | 'snapshot' } | null;
  onFuturePlans: () => void;
  query: string;
  onQuery: (next: string) => void;
  /** The field here has the keyboard, so the results belong under it. */
  onSearchFocus: () => void;
  /** The matches for `query`, rendered by App. Null when none are wanted here. */
  results: ReactNode;
  /** The place picked from the results, if any: its name and one line about it. */
  chosen: { label: string; detail: string } | null;
  onClearChosen: () => void;
  /** The main button, once a place is chosen. */
  onSunlight: () => void;
  /** Into the city with nothing chosen — here and at the foot of LandingMore. */
  onExplore: () => void;
  /**
   * Present only on a device that can start a headset session, and only once
   * the city exists — there is nothing to stand in before that.
   */
  onEnterVr?: () => void;
  /** The city is still loading, or failed to. Null once it is here. */
  loading: { progress: LoadProgress; error: string | null } | null;
  /** The moment the city is showing: "21 June 2026, 12:00 · Winter". */
  when: string | null;
  /** The map's credit, drawn in the city's window. See MapAttribution. */
  credit: ReactNode;
  /**
   * Where the city's window is, whenever it moves — on every scroll as well
   * as every resize, so App keeps it in a ref rather than in state.
   */
  onInset: (inset: ScreenInset) => void;
  /** The film is shown finished rather than played. */
  reducedMotion: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const window_ = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useLandingReveal(root, reducedMotion);
  /*
   * Said when the main button is pressed with nothing chosen, rather than
   * the button being disabled: a greyed-out button tells somebody that
   * something is wrong without telling them what to do about it.
   */


  /*
   * The callback, held where the observer can reach the current one without
   * being torn down and rebuilt by it. App passes an inline function (one
   * that writes a ref), so its identity changes on every render — and App
   * renders on every tick of the download.
   */
  const report = useRef(onInset);
  useEffect(() => {
    report.current = onInset;
  });

  /*
   * Measure the city's window whenever it moves: a resize, the type growing
   * with the window, the steps wrapping onto another line — and a scroll,
   * which carries the window up the screen.
   *
   * A layout effect so the measurement exists before the first paint. The
   * city is not drawn until it has loaded, by which time this has long been
   * reported, and ViewInset takes the first report without easing — so the
   * city's first frame is already inside the window.
   */
  useLayoutEffect(() => {
    const page = root.current;
    const hole = window_.current;
    if (!page || !hole) return;
    const measure = (snap = false) => {
      const outer = page.getBoundingClientRect();
      const inner = hole.getBoundingClientRect();
      report.current({
        left: Math.round(inner.left - outer.left),
        top: Math.round(inner.top - outer.top),
        bottom: Math.round(outer.bottom - inner.bottom),
        snap,
      });
      /*
       * The map's credit rides at the foot of the window, and the bar is
       * fixed over the top of the page. Scrolling the window up, the credit
       * reaches the bar while a strip of map is still showing under it — a
       * map on screen with its credit hidden, which the map's licence does
       * not allow. So once less than `CREDIT_ROOM` of the window is still
       * clear of the bar, the window is covered over: no map without its
       * credit. The bar's height is where the window starts on the unscrolled
       * page, its offset in the grid.
       */
      const headerBottom = document.querySelector('.header')?.getBoundingClientRect().bottom ?? outer.top;
      const clearOfBar = inner.bottom - Math.max(outer.top, headerBottom);
      hole.toggleAttribute('data-covered', clearOfBar < CREDIT_ROOM);
    };
    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(page);
    observer.observe(hole);
    /*
     * The page scrolls, and the window scrolls with it: the city follows its
     * frame up and out of view, at once rather than easing after it.
     */
    const onScroll = () => measure(true);
    page.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      page.removeEventListener('scroll', onScroll);
    };
  }, []);


  const explore = () => chosen ? onSunlight() : onExplore();
  const showInfo = (target: string) => {
    const details = root.current?.querySelector<HTMLDetailsElement>('#landing-background');
    if (details) details.open = true;
    requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' }));
  };

  return (
    <section className="landing landing--reference" ref={root} aria-labelledby="landing-title">
      {/*
        The first screen, laid out as a grid. `.landing` around it is the
        part that scrolls, carrying this and LandingMore under it.
      */}
      <div className="landing__screen">
      {/*
        One wrapper for the three parts that stack into one sheet on a phone.
        On a wide screen it steps out of the way (display: contents) and the
        three take their own places in the first screen's grid.
      */}
      <div className="landing__sheet">
        <div className="landing__hero">
          <p className="landing__kicker">YOUR CITY. A NEW PERSPECTIVE.</p>
          <h1 className="landing__title" id="landing-title">See Melbourne CBD from a new perspective.</h1>
          <p className="landing__body">Explore developments, shadows, rooftop solar, pedestrian forecasts and sunlight at your window—all in one 3D city.</p>
          <p className="landing__stat">
            99.2% of occupied private dwellings in Melbourne suburb were flats or apartments.{' '}
            <a href="https://www.abs.gov.au/census/find-census-data/quickstats/2021/SAL21640" target="_blank" rel="noreferrer noopener">
              ABS Census 2021<span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          </p>

          <div className="landing__search">
            <label className="landing__field">
              <svg width="18" height="18" viewBox="0 0 17 17" aria-hidden="true">
                <circle cx="7" cy="7" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <line
                  x1="11"
                  y1="11"
                  x2="15.4"
                  y2="15.4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
              <input
                ref={field}
                // The "/" key finds whichever search field is on screen. See Header.
                data-search-field
                value={query}
                onChange={(event) => onQuery(event.target.value)}
                onFocus={onSearchFocus}
                placeholder={loading ? 'The city is loading…' : 'Search a street or address'}
                aria-label="Search for a landmark, street or address"
                // Nothing to search until the buildings are here.
                disabled={loading !== null}
              />
              {query && (
                <button
                  type="button"
                  className="landing__clear"
                  onClick={() => {
                    onQuery('');
                    field.current?.focus();
                  }}
                  aria-label="Clear the search"
                >
                  <Cross />
                </button>
              )}
            </label>

            {results}

            {/*
              What has been chosen, once something has. The field empties so
              it is ready for another search; this row is where the answer
              stays, with the way to undo it beside it.
            */}
            {chosen && !query && (
              <div className="landing__chosen">
                <Pin />
                <span className="landing__chosen-words">
                  <span className="landing__chosen-label">{chosen.label}</span>
                  <small>{chosen.detail}</small>
                </span>
                <button
                  type="button"
                  className="landing__clear"
                  onClick={onClearChosen}
                  aria-label={`Clear ${chosen.label}`}
                >
                  <Cross />
                </button>
              </div>
            )}
          </div>



          <button type="button" className="button button--block landing__cta" onClick={explore}>
            Explore Melbourne CBD
            <Arrow />
          </button>

          {!query && !chosen && (
            <div className="landing__suggestions" aria-label="Suggested street searches">
              <span>Suggested streets:</span>
              {['Bourke Street', 'Collins Street', 'Swanston Street'].map(street => (
                <button key={street} type="button" disabled={loading !== null}
                  onClick={() => {
                    onQuery(street);
                    onSearchFocus();
                    field.current?.focus();
                  }}>
                  {street}
                </button>
              ))}
            </div>
          )}

          {onEnterVr && (
            <button
              type="button"
              className="button button--block button--ghost landing__vr"
              /*
               * The handler IS the call — see xrStore.ts. Nothing may be
               * awaited or confirmed in front of it, or the session never
               * opens.
               */
              onClick={onEnterVr}
            >
              Enter in VR
            </button>
          )}


        </div>

        {/*
          Focusable so "How it works" in the header can move the keyboard
          here as well as the eye; -1 keeps it out of the tab order.
        */}


        <footer className="landing__foot">
          <p>
            Illustrative model · Demo data
            <span className="landing__foot-sep" aria-hidden="true">
              |
            </span>
            <SourcesLink />
          </p>

        </footer>
      </div>

      {/*
        The window onto the city. Transparent and deaf to the pointer, so the
        city under it is what gets dragged and clicked; only the map key and
        the credit in it answer.
      */}
      <div className="landing__window" ref={window_}>
        {loading && <Loading progress={loading.progress} error={loading.error} />}
        {!loading && <>
          <div className="landing__feature-pins" aria-label="Explore city features">
            {LANDING_FEATURES.map(feature => <button key={feature.key} type="button" className={`landing__pin landing__pin--${feature.key}`} onClick={() => onFeature(feature.key)}>
              <LandingFeatureIcon feature={feature.key} /><span>{feature.pin}</span>
            </button>)}
          </div>
          <p className="landing__model-label">Interactive 3D model · {when}</p>
        </>}
        {credit}
      </div>
      </div>

      <nav className="landing__feature-rail" aria-label="Choose a city feature">
        {LANDING_FEATURES.map(feature => <button key={feature.key} type="button" disabled={loading !== null} onClick={() => onFeature(feature.key)}>
          <LandingFeatureIcon feature={feature.key} /><span>{feature.short}</span>
        </button>)}
      </nav>
      <section className="landing__features" aria-labelledby="landing-features-title">
        <h2 id="landing-features-title">One city. Five ways to explore.</h2>
        <p className="landing__features-lead">Choose what matters to your everyday life.</p>
        <div className="landing__feature-grid">
          {LANDING_FEATURES.map(feature => <button type="button" className={`landing__feature landing__feature--${feature.key}`} key={feature.key} disabled={loading !== null} onClick={() => onFeature(feature.key)}>
            <div className="landing__feature-picture"><img src={bundled(`how/${feature.image}`)} alt="" loading="lazy" /><span className="landing__picture-icon"><LandingFeatureIcon feature={feature.key} /></span></div>
            <h3><LandingFeatureIcon feature={feature.key} />{feature.title}</h3><p>{feature.body}</p>
          </button>)}
        </div>
        <p className="landing__image-credit">Illustrative model previews · OpenFreeMap · © OpenMapTiles · © OpenStreetMap</p>
        <section className="landing__steps" id={HOW_IT_WORKS_ID} tabIndex={-1} aria-label="How it works">
          <h3>Start with a place you know.</h3>
          <ol role="list">{['Find a street', 'Choose a building', 'Explore your perspective'].map((step, index) => <li key={step} className="landing__step"><span className="landing__step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span className="landing__step-title">{step}</span></li>)}</ol>
        </section>
      </section>
      <section className="landing__project-info" aria-labelledby="landing-project-title">
        <div>
          <h2 id="landing-project-title">Made for Melbourne, by Team TE01.</h2>
          <p>A Monash FIT5120 project using City of Melbourne’s Building Footprints 2023 and Development Activity Monitor data to explore how the CBD could change.</p>
          {modelSummary && <p className="landing__data-summary">{modelSummary.developments.toLocaleString('en-AU')} development records · {modelSummary.buildings.toLocaleString('en-AU')} address-searchable buildings · {modelSummary.source === 'live' ? 'Refreshed from the team API' : 'Saved model snapshot'}</p>}
        </div>
        <div>
          <p>The city is a simplified model. Solar output is an estimate; pedestrian forecasts are predictions at mapped sensors.</p>
          <button type="button" className="landing__future-link" onClick={onFuturePlans}>Explore future plans &amp; project questions <Arrow /></button>
          <details className="landing__repo-links"><summary>Project repositories</summary><a href="https://github.com/Monash-FIT5120-TE01/my-city-twin" target="_blank" rel="noreferrer noopener">My City Twin frontend ↗</a><a href="https://github.com/Monash-FIT5120-TE01/fit5120-te01-be" target="_blank" rel="noreferrer noopener">Team data API &amp; backend ↗</a></details>
        </div>
      </section>
      <footer className="landing__site-footer">
        <span className="landing__footer-brand"><LandingFeatureIcon feature="developments" />My City Twin</span>
        <span>Illustrative model · Demo data</span>
        <SourcesLink />
        <button type="button" onClick={() => showInfo('country-title')}>Acknowledgement of Country</button>
      </footer>
      <details className="landing__background" id="landing-background">
        <summary>About this project &amp; Melbourne’s open data</summary>
        <LandingMore onExplore={onExplore} onFeature={onFeature} />
      </details>

    </section>
  );
}

/**
 * The skyline being drawn, once.
 *
 * Hidden until it is actually running: a video element paints white before
 * its first frame is decoded, and on the cream that is a white box flashing
 * where the drawing will be.
 *
 * Under a reduced-motion preference it does not play. It is shown on its
 * LAST frame, the finished skyline — the first frame is an empty page with
 * one stroke on it, which is a picture of nothing.
 */
export function SkylineFilm({ reducedMotion }: { reducedMotion: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    const film = video.current;
    if (!film || reducedMotion) return;
    const page = film.closest('.landing');
    let entered = false;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && !entered) {
          entered = true;
          film.currentTime = 0;
          void film.play().catch(() => {
            // Keep a decoded frame visible if autoplay is unavailable.
            if (film.readyState >= 2) setShowing(true);
          });
        } else if (!entry.isIntersecting) {
          entered = false;
          film.pause();
        }
      }
    }, { root: page, threshold: 0.15 });
    observer.observe(film);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const finished = () => {
    const film = video.current;
    if (!film || !Number.isFinite(film.duration)) return;
    film.pause();
    film.currentTime = Math.max(0, film.duration - 0.05);
  };

  return (
    <div className="landing__film">
      <video
        ref={video}
        className={showing ? 'is-showing' : undefined}
        src={bundled('landing-animation.mp4')}
        autoPlay={!reducedMotion}
        muted
        playsInline
        preload="auto"
        onPlaying={() => setShowing(true)}
        onLoadedData={() => setShowing(true)}
        onLoadedMetadata={() => {
          if (reducedMotion) finished();
        }}
        onSeeked={() => {
          if (reducedMotion) setShowing(true);
        }}
        // Decorative: the heading below says everything it says.
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * The city's download, in the city's window.
 *
 * Driven by real byte counts, as the full-screen loading screen is, so a
 * stalled network looks stalled. With no content length there is no
 * denominator to show, and the bar sweeps instead of guessing one.
 */
function Loading({ progress, error }: { progress: LoadProgress; error: string | null }) {
  const failed = progress.phase === 'failed' || error !== null;
  const indeterminate = progress.phase === 'downloading' && progress.totalBytes === null;
  return (
    <div className="landing__loading" role="status" aria-live="polite">
      <p className="landing__loading-title">
        {failed ? 'The city model did not load' : 'Building the city model'}
      </p>
      {failed ? (
        <p className="landing__loading-meta">{error ?? 'The snapshot could not be read.'}</p>
      ) : (
        <>
          <div
            className={`landing__track${indeterminate ? ' is-indeterminate' : ''}`}
            role="progressbar"
            aria-valuenow={indeterminate ? undefined : progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Loading the city model"
          >
            <div
              className="landing__fill"
              style={indeterminate ? undefined : { width: `${progress.percent}%` }}
            />
          </div>
          <p className="landing__loading-meta">
            {progress.label}
            {indeterminate ? '' : ` · ${progress.percent}%`}
          </p>
        </>
      )}
    </div>
  );
}

// ── the icons: an arrow for the ways in, a cross to clear, a pin for the chosen place

function Arrow() {
  return (
    <svg width="17" height="10" viewBox="0 0 17 10" aria-hidden="true">
      <path
        d="M0 5h15M11 1l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function Pin() {
  return (
    <svg className="landing__pin" width="14" height="18" viewBox="0 0 14 18" aria-hidden="true">
      <path
        d="M7 17s5.6-5.6 5.6-10A5.6 5.6 0 0 0 1.4 7C1.4 11.4 7 17 7 17Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="7" r="2" fill="currentColor" />
    </svg>
  );
}
