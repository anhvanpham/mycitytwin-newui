# Street activity integration

The **Street activity** link in the existing header opens `?view=activity` on the shared `SceneCanvas`. No second mapping library, embedded prototype or replacement navigation is used. The existing 2D/3D buttons, map layers, basemap, buildings and camera controls remain available.

The city map is the activity view. It draws soft colour halos that fade around each sensor, with predicted hourly movements; grey halos have unavailable forecasts, never zero counts. The glow is a visual treatment around sensor locations, not an estimate of counts on unsensed streets. Sensors retain transparent keyboard/click targets, and the selected sensor keeps its readable label. The selected date, hour and sensor are saved in the URL, including midnight hours. A bottom map dock groups the date, daily forecast slider and selected count. The selected sensor name appears directly before suggested times in the sidebar and updates when a sensor halo or its keyboard target is selected. There is no sensor dropdown or selection hint. Weather appears beside suggested times in the sidebar. The slider stays on the chosen date and stops at the available weather hours; switching dates preserves the hour where possible, otherwise selects the nearest covered hour. Suggested times and source details remain in the sidebar. Coverage is limited to sensors inside the existing CBD boundary. The sidebar shares the docked desktop column and mobile sheet used by the other map pages. Explore the city precedes the pastel-pink Street activity link in the shared header.

## Current data

- The inventory is selected from every currently reporting sensor. All sensors inside the existing CBD map boundary are included, with coverage counts and unavailable hours recorded in the asset. The current inventory has 99 reporting sensors: 46 are inside this boundary and 53 are outside. All 46 are included; 44 have complete forecasts, and two have gaps (5 and 24 hours) shown in grey rather than as fabricated zeroes. Sensors outside the map boundary are excluded.
- Forecast counts use the median of up to four observed prior matching weekday/hour patterns. The research RNN/Transformer is not used for this city layer because recent complete inputs are unavailable. No live counts are fabricated.
- Weather limits the time horizon. Hourly weather currently uses the explicitly labelled Open-Meteo fallback; official BOM daily rain chances and forecast text supplement the dates BOM covers. A missing BOM daily value is shown as unavailable, not zero rain chance.
- Recommendations compare future daytime hours at the chosen sensor, subject to temperature, hourly rain, wind and available BOM daily rain-chance limits. Users can choose quieter or livelier streets. Nearby event warnings do not filter or change recommendations.
- Events now combine official City of Melbourne What's On comedy, music, festival and major-event listings with the verified Fed Square organiser session. The current import contains 102 dated performances from 21 listings, including comedy and Fringe sessions. Only individual rows with a specific venue, coordinates, date, start and end are accepted; exhibitions' ordinary opening hours, vague times, cancelled/postponed events and whole-festival date ranges are excluded. Sessions must overlap the weather horizon (including the warning buffer) and lie within 1 km of a displayed sensor. Coverage remains incomplete and sources can be inaccessible; the research `data/event_sources.json` records accepted and skipped listings. Events appear as warnings only; they do not change counts, weather eligibility or recommendations, and no event training is performed.
- The bottom timeline meets the sidebar and screen edges, with a translucent blurred background. It enters once, and the count/weather summary gently updates on hour or sensor changes. Reduced-motion preferences disable those animations.
- The public JSON is a **snapshot**, not an automatically updating production service. Source times and expired forecasts are identified in the interface. Expired hours cannot produce recommendations.

## Refreshing the asset

Refresh observations/weather and generate `output/city_forecast.csv` in the research project first. Refresh official event sessions against the current weather horizon:

```sh
python3 scripts/refresh-street-events.py --asset public/data/street-activity.json --root "/Users/anhpham/Desktop/Sem 2 2026/FIT5120 - Industry Experience/Main Project/street-forecast"
```

This reads four official category pages and their event listings with two concurrent requests, archives the source pages in the research folder, preserves each session's first observed time and produces an import report. `--cached` revalidates those archived pages without fetching. Failed pages and sessions without explicit times are skipped; an empty import preserves the previous event file. Additional organiser sessions can be maintained in `data/upcoming_events.json` with `id`, `name`, `venue`, `start`, `end`, `lat`, `lon`, `knownAt` and `sourceUrl`. Export the aligned forecast and events into the app:

```sh
python3 scripts/export-street-activity.py --forecast-dir "/Users/anhpham/Desktop/Sem 2 2026/FIT5120 - Industry Experience/Main Project/street-forecast"
```

Select the inventory using the actual map boundary before downloading counts:

```sh
node scripts/select-cbd-sensors.mjs /path/to/sensor_inventory.json /path/to/cbd_sensor_selection.json
```

Then run `city_heatmap.py --counts-file data/city_counts_cbd.csv --selection data/cbd_sensor_selection.json --no-render` in the research project. The exporter records eligible/reporting/forecast coverage without hard-coding the network size. The loader rejects misaligned weather/count columns, missing weather hours and invalid data. Missing sensor predictions use explicit null values with an unknown activity label; they remain selectable and are excluded from suggestions.

Run `npm test` and `npm run build` after refreshing. Versioned releases require their normal release build and deployment; a source edit or local build does not publish changes to the live website.
