# My City Twin — new UI preview

Standalone frontend copy of My City Twin, containing the ver-4 UI.
The original team repository, backend repositories, and mycitytwin.com deployments are separate.

## Run locally

```bash
npm ci
npm run dev
```

## Check

```bash
npm test
npm run build
```

## Deploy a preview for the group

```bash
npx wrangler login
npm run deploy
```

Use your personal Cloudflare account. The Worker is named `mycitytwin-newui` and uses a separate `workers.dev` address; no team custom domain is configured.
Wrangler prints the preview URL after a successful deployment. Share that URL with the group.
The root opens ver-4; its direct path is `/ver-4/`.

`npm run deploy` rebuilds ver-4 in this repository. Previous version folders are preserved.
Future plans is a guided prototype with preset questions and sourced replies, not a connected AI backend.

Source snapshot: the team frontend at `62e6d79`, with independent deployment configuration.
Original project: https://github.com/Monash-FIT5120-TE01/my-city-twin

### Integrated CBD basemap preview

The existing sunlight scene now places OpenFreeMap streets underneath the surveyed buildings. MapLibre renders a shared, georeferenced ground texture; the same Three.js scene retains the original shadows, spot/window measurements, selection and comparison cameras. There is no separate street-map tab. `2D view` gives an overhead view; `3D view` restores the angled city. Both comparison panels use the same map and view setting.

The visible map covers the full CBD plus surrounding fringe: RMIT/Queen Victoria Market and the Carlton edge, Docklands, Southbank and the Parliament/gardens edge. The shared bounds are west 144.940, east 144.983, south -37.831 and north -37.799. A council 2023 footprint supplement adds 5,395 structures (12,102 parts) to the original 1,548-building API extract. Both snapshot and live-core loads merge this supplement by structure ID, preserving core geometry and addresses and preventing live refreshes from dropping the fringe. All maps use the landing page's existing circular haze boundary: the centre of the full city model extent, a clear radius of 0.62 times its longest side, and a fully faded radius of 1.2 times that side. Future Plans uses these same scene metres projected back to geographic coordinates, including after live model refreshes. The 2D/3D city maps and both comparison panes use the same smoothstep fade. The landing page retains its original haze treatment. This is not an official administrative boundary. Outside building geometry remains available to shadow calculations; the edge treatment is visual only. The map uses pearl-lavender, icy blue and soft peach existing buildings, blush highlights, mint crystal proposals and softer lavender selection outlines; proposal opacity values remain 0.95 / 0.90 / 0.78. Frozen releases are unchanged.

`public/data/street-details.json` supplies recorded tree/pole positions and illustrative road/crossing paint. Instanced 3D trees use trunk diameter to illustrate heights (4–22 m; missing diameter defaults to 30 cm), rather than claiming surveyed heights. Pole size is an illustrative 8 m. Streetlights fade on between solar altitudes +1° and −5° using the selected date/time, with emissive bulbs, ground light pools and at most six nearby point lights. They fade off again at dawn. These visuals do not change the building-only sunlight calculations or model measured lighting levels. Both 2D and 3D views and both comparison panes share these layers. Landmark search and labels use the supplied QA list. All six layer controls are available on the integrated map. The public OpenFreeMap service needs internet access, but no account or API key; offline, the original plain-ground sunlight model still works.

Refresh the bundled public extract with `npm run data:streets`, review `src/data/street-details-summary.json`, and run `npm test` and `npm run build`. Attribution and data limitations are included in the interface. The importer does not rebuild frozen releases.

### Additional lighting data

The lighting extract now retains every council feature-light asset in the CBD download, including hanging, wall, bridge, seat, stair and ground fixtures, with mounting descriptions, lamp types and available wattages. Rendering groups same-type positions within 0.5 m from one source or 3 m across sources, retaining source asset references, and omits locations inside the simplified building footprints; those source records remain in `lightingAssets`. Dense fixture groups are hidden across the visual layer, including their glows: connected groups of three or more fixtures with gaps below 8 m are omitted, and the remaining lights are spaced at least 12 m apart. The previously excluded intersection arrays remain hidden. Every original asset stays in the source inventory. Only pole records create poles. Other mounting heights/shapes are illustrative; unknown mountings use small ground markers. Solar dusk/dawn switching applies to all visual fixtures.

`lightLevels` preserves the separate council lux dataset for the CBD bounds. The optional **Historical light levels** map layer displays recorded samples from **16 September 2014**, purple for low values through gold for high values (logarithmic colour scale, capped at 100 lux). It defaults off, does not interpolate gaps or add poles, and does not change with the model date/time. It is historical evidence, not current illumination or a calibrated simulation. Both comparison panes and both perspectives share the switch. The source link and limitations appear under Sources.

### Decorative tree lighting

At dusk, warmly glowing lanterns accompany recorded tree locations, spaced at least 12 m apart to avoid dense clusters. Soft ground pools, subtle foliage emission and up to two nearby tree lights add night-time context without extra pole rows. These placements are decorative and kept separate from the mapped asset counts and historical lux data. Both Trees and Streetlights switches control them, and daylight switches them off. Building sunlight calculations are unchanged.

### Sporting event warnings

The Street activity event section includes official MCG and Marvel Stadium AFL
venue calendars and Australian Open dates. It retains the existing comedy,
concert and festival snapshot. AFLW and other grounds are not comprehensively
covered. Sources are refreshed explicitly; the deployed site reads the last
exported snapshot, rather than continuously polling organisers.

Run the existing City What's On refresh, then the sporting refresh and export:

```bash
python3 scripts/refresh-sports-events.py --asset public/data/street-activity.json --root /path/to/street-forecast
python3 scripts/export-street-activity.py --forecast-dir /path/to/street-forecast --output public/data/street-activity.json
python3 scripts/test_sports_events.py
npm run build:release
```

Date-only tennis tournament ranges appear as calendar context, labelled when
outside the weather horizon; they do not warn that every hour is busy. Published
start times without finish times have a two-hour warning window around the
start, with the missing finish stated. Confirmed sessions keep the existing
arrival/departure buffer. AFL at the MCG can also flag sensors within 400 m of
the Flinders Street station approach, based on the MCG's published access guide.
This is a warning area, not a crowd-size or route-flow model. Events never change
predicted pedestrian counts, recommendation ranking, or model training.


## Future Plans map

The timeline starts in Projects mode. Optional Trees and Buildings modes show one context layer at a time on a muted basemap. Numbered pins match cards that open guided conversations directly. Tree locations cluster until zoomed in; selecting a complete 200 m block opens coverage/tree counts and exploratory links to the urban forest and transport plans. The year changes published project schedules, while the recorded context remains fixed.

The context snapshot covers the same CBD and fringe bounds as the expanded city model. Its 5 October 2026 export contains 23,154 distinct council tree records and 299 complete block samples, using the original core footprints plus the council fringe supplement. Footprints are from May 2023. Coverage is sampled every 5 m as the union of building parts, and is not population density, floor area, canopy or a forecast of construction. The local Future API supplies records in development; saved exports are used when unavailable. Sources and method are available in the map disclosure.

## Future Plans backend

The standalone preview now reads a dedicated Cloudflare D1 database through the
same-origin `/future-api` API. The `FUTURE_DB` binding is configured in
`wrangler.jsonc`; the read-only API implementation is `worker/future.ts`.

- `/future-api/api/health` checks the database connection.
- `/future-api/api/catalogue` returns projects, topics, stages, written answers,
  reviewed news and verified map records.
- `/future-api/api/projects`, `/api/projects/:id`, `/api/topics` and `/api/news`
  provide individual collections or records beneath the same prefix.
- `/future-api/api/spatial-context` serves the fixed baseline from release assets.

The frontend uses `/future-api` by default, with the saved catalogue as a fallback.
Vite proxies this prefix to the local Python backend during development.
`VITE_FUTURE_API_URL` can override the prefix for another hosted API.

`worker/future-database.sql` is the initial schema-and-data import for an empty D1
database. Do not repeat this seed import over populated hosted data. Manage later
changes through authenticated D1 administration and retain source verification.
There is no public write API or automatic news-ingestion task.

The database/API handoff is in the Main Project workspace at
`future-cbd-backend/future-cbd-backend-handoff.zip`. The deployed standalone preview
is `https://mycitytwin-newui.vananhpham.workers.dev/ver-4/?view=future`.
