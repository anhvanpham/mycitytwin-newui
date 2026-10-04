/*
 * ─────────────────────────────────────────────────────────────────────────
 * WHERE THE NUMBERS COME FROM, AND WHAT THE COLOURS MEAN
 * ─────────────────────────────────────────────────────────────────────────
 *
 * WHAT THIS IS
 *   Two small things every screen that shows the city needs, written once:
 *
 *   SourcesLink  "Sources & limitations" in the fine print, and the window
 *                it opens — the three figures about the CBD with their
 *                sources, what the model does not claim, and the data
 *                licences.
 *   MapKey       the key to the two colours the city is drawn in.
 *
 * WHERE THEY APPEAR
 *   SourcesLink: the front page's fine print, and the line of fine print
 *   App draws along the foot of the map on the sunlight screen. MapKey: the
 *   front page's window onto the city, and the sunlight screen's time bar.
 *   Written twice, the two copies of a licence line would drift.
 */

import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NOT_AN_ASSESSMENT } from './words';
import '../styles/sources.css';
import streetSummary from '../data/street-details-summary.json';

/**
 * Three figures about living in the CBD, each with where it came from.
 *
 * WHY THE SOURCE IS PART OF THE DATA AND NOT A FOOTNOTE
 *   A percentage with no source is an assertion. These, with the three on
 *   the front page (LandingMore), are the only numbers in the application
 *   that did not come out of the model — everything else on screen is
 *   computed from surveyed geometry and can be checked against it, and these
 *   cannot. So each one carries its origin in
 *   the same object, and nothing can render one without the other.
 *
 * WHY EACH URL POINTS AT THE FIGURE AND NOT AT THE ORGANISATION
 *   Every link below was opened and the number read off the page it lands
 *   on. A citation that goes to a department's front door leaves the reader
 *   to find the claim themselves. The walking figure took two attempts for
 *   that reason: the strategy's own web page does not contain it, so the
 *   link goes into the strategy's PDF, at the page that states it.
 *
 * WHY EACH ONE SAYS WHAT IT IS OF
 *   "99.2%" is meaningless alone; "of occupied private dwellings" is the
 *   fact, which is why the qualifier is never shortened.
 */
const FIGURES = [
  {
    figure: '99.2%',
    title: 'Apartment living is the norm.',
    body: 'Of occupied private dwellings in Melbourne suburb were flats or apartments.',
    source: 'ABS Census 2021',
    /* QuickStats for the suburb of Melbourne; the page gives "Flat or
       apartment: 27,250, 99.2%" under dwelling structure. */
    href: 'https://www.abs.gov.au/census/find-census-data/quickstats/2021/SAL21640',
  },
  {
    figure: '89%',
    title: 'A city experienced on foot.',
    body: 'Of trips within the Hoddle Grid were made on foot.',
    source: 'City of Melbourne, Transport Strategy 2030, p. 39',
    /* The strategy's own web page does not state the figure; the PDF does,
       on printed p. 39 (PDF page 21): "Overall, 89 per cent of trips within
       the Hoddle Grid are made on foot." */
    href: 'https://www.melbourne.vic.gov.au/media-files/2024-05/transport-strategy-2030-city-of-melbourne.pdf#page=21',
  },
  {
    figure: '32%',
    title: 'Greener spaces are a priority.',
    body: 'Of CBD respondents prioritised plants, trees and improved open spaces.',
    source: '2024 Neighbourhood Survey · 532 CBD responses',
    /* The consultation summary lists "More plants, trees and improved open
       spaces (32%)" as the CBD's third priority, from 532 CBD responses. */
    href: 'https://participate.melbourne.vic.gov.au/neighbourhood-survey',
  },
];

/**
 * "Sources & limitations", and the window it opens: a native modal
 * <dialog>, so focus is held inside it and Escape closes it without any
 * code here.
 */
export function SourcesLink() {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const content = (
      <dialog
        className="sources"
        ref={dialog}
        aria-labelledby={titleId}
        // A click on the backdrop — outside the card — closes it.
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="sources-card">
          <div className="sources-head">
            <h2 id={titleId}>Sources &amp; limitations</h2>
            <button
              type="button"
              className="sources__close"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
            >
              <Cross />
            </button>
          </div>

          <p className="sources-lead">{NOT_AN_ASSESSMENT}</p>

          <h3>Why it matters</h3>
          <ol className="sources__figures" role="list">
            {FIGURES.map((entry) => (
              <li key={entry.title}>
                <p className="sources__figure">{entry.figure}</p>
                <p className="sources__figure-title">{entry.title}</p>
                <p className="sources__figure-body">{entry.body}</p>
                <p className="sources__figure-source">
                  Source:{' '}
                  {/*
                    A new tab, because leaving the page would throw away the
                    date, the hour and whatever is chosen — all of which live
                    in this tab's state.
                  */}
                  <a href={entry.href} target="_blank" rel="noreferrer noopener">
                    {entry.source}
                    <span className="visually-hidden"> (opens in a new tab)</span>
                  </a>
                </p>
              </li>
            ))}
          </ol>
          {/*
            What the three figures do NOT say, which is the part a reader
            would otherwise supply and get wrong. "Melbourne" as a suburb is
            larger than the Hoddle Grid this model covers, and the last two
            count different things: trips are events, respondents are people.
          */}
          <p className="sources-note">
            Melbourne suburb extends beyond the Hoddle Grid. Walking figures describe
            trips; survey figures describe respondents.
          </p>

          <h3>CBD street details</h3>
          <p className="sources-note">
            {streetSummary.trees.toLocaleString()} tree locations and {streetSummary.lights.toLocaleString()} mapped light poles cover the CBD and nearby streets in this extract. Council feature lighting is supplemented by OpenStreetMap street lamps; coverage is incomplete. Multiple lights at one pole are combined. Locations conflicting with building footprints are omitted.
          </p>
          <p className="sources-note">
            The sunlight model uses a georeferenced OpenFreeMap basemap rendered by MapLibre, centred on the approximate Hoddle Grid with a softly fading edge (Spencer, Spring, La Trobe and Flinders streets). Trees and poles use recorded locations. The tree records contain trunk diameter, but no measured height: 3D tree heights (4–22 m) are illustrative estimates from trunk size, with a default where diameter is missing; crown shapes are illustrative. Pole height is an illustrative 8 m. Lights fade on as solar altitude drops from 1° to −5°, and fade off again at dawn. Warm ground glows and nearby lighting illustrate the effect; they are not measured illumination or a simulation of the council’s switching schedule. Road widths and lane divider paint are inferred from mapped lane counts. {streetSummary.crossings} crossings use explicitly mapped paint styles. Sunlight comparisons use the original building geometry and solar calculations on this same map. The basemap, trees and lamps do not supply new shadow calculations; the visual CBD fade does not remove buildings from the calculations.
          </p>
          <p className="sources-note">
            Basemap: <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> / <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>, based on OpenStreetMap. Sources: <a href={streetSummary.source.trees} target="_blank" rel="noreferrer">City of Melbourne tree inventory</a> and <a href={streetSummary.source.lights} target="_blank" rel="noreferrer">feature lighting</a> (CC BY; positions reprojected and shapes simplified). © <a href={streetSummary.source.osm} target="_blank" rel="noreferrer">OpenStreetMap contributors</a>, ODbL 1.0; road/crossing/lamp extract retrieved {streetSummary.source.retrievedAt.slice(0,10)}. Landmark names and locations use the supplied 51-place QA list; historical sites remain searchable but have no current map label.
          </p>
          <h3>Data</h3>
          <p className="sources-note">
            Building Footprints 2023 and Development Activity Monitor © City of
            Melbourne. Draft Open Space Data © Victorian Planning Authority. Both
            licensed CC BY 4.0. Modified: reprojected, extruded to simple block
            massing, and grouped by structure.
          </p>
        </div>
      </dialog>
  );
  return (
    <>
      <button type="button" className="sources__link" onClick={() => dialog.current?.showModal()}>
        Sources &amp; limitations
      </button>
      {typeof document === 'undefined' ? content : createPortal(content, document.body)}
    </>
  );
}

/**
 * The key to the city's colours.
 *
 * The swatches are the colours CityMassing and DevelopmentMassings draw, and
 * each is named in words beside it: the words say which is which, and a
 * reader who cannot tell the two apart by colour loses the shortcut and
 * nothing else. "In progress" is not here because the city does not draw
 * projects under construction apart from approved ones. `className`
 * places it; each screen puts it in a different corner.
 */
export function MapKey({ className }: { className?: string }) {
  return (
    <aside className={`mapkey${className ? ` ${className}` : ''}`} aria-label="Map key">
      <span className="mapkey__row">
        <span className="mapkey__swatch mapkey__swatch--existing" aria-hidden="true" />
        Existing
      </span>
      <span className="mapkey__row">
        <span className="mapkey__swatch mapkey__swatch--approved" aria-hidden="true" />
        Approved
      </span>
    </aside>
  );
}

/** The close button's cross. */
function Cross() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
