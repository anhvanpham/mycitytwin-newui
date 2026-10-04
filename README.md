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

The visible map is centred on an approximate Hoddle Grid preview boundary along Spencer, Spring, La Trobe and Flinders streets. Scenery gently blends into the sky over an 85 m inner / 155 m outer mist band, then clips only after the fade is complete. This is not an official administrative boundary. Outside building geometry remains available to shadow calculations; the edge treatment is visual only. The map uses pearl-lavender, icy blue and soft peach existing buildings, blush highlights, mint crystal proposals and softer lavender selection outlines; proposal opacity values remain 0.95 / 0.90 / 0.78. The landing page and frozen releases are unchanged.

`public/data/street-details.json` supplies recorded tree/pole positions and illustrative road/crossing paint. Instanced 3D trees use trunk diameter to illustrate heights (4–22 m; missing diameter defaults to 30 cm), rather than claiming surveyed heights. Pole size is an illustrative 8 m. Streetlights fade on between solar altitudes +1° and −5° using the selected date/time, with emissive bulbs, ground light pools and at most six nearby point lights. They fade off again at dawn. These visuals do not change the building-only sunlight calculations or model measured lighting levels. Both 2D and 3D views and both comparison panes share these layers. Landmark search and labels use the supplied QA list. All six layer controls are available on the integrated map. The public OpenFreeMap service needs internet access, but no account or API key; offline, the original plain-ground sunlight model still works.

Refresh the bundled public extract with `npm run data:streets`, review `src/data/street-details-summary.json`, and run `npm test` and `npm run build`. Attribution and data limitations are included in the interface. The importer does not rebuild frozen releases.
