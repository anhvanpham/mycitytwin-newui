# Roadworks and closures on Street Activity

The panel is prepared in source. It has no sample incidents or embedded API key. Until a server key is configured, it says that live road notices are not connected and links to the official traffic site.

## Activate the official feeds

1. Register for a Transport Victoria Open Data account and obtain access to the [planned](https://opendata.transport.vic.gov.au/dataset/planned-disruptions-road) and [unplanned](https://opendata.transport.vic.gov.au/dataset/unplanned-disruptions-road) road feeds.
2. From the website checkout, run `npx wrangler secret put TRANSPORT_VIC_API_KEY` and enter the key in the terminal prompt. Keep it out of chat, source control and all `VITE_*` settings.
3. Build and release the intended version through the existing release process, then deploy the Worker. Source changes alone do not update the frozen `/ver-4/` release.
4. Check `/road-disruptions-api`: each feed should report `ready`, with a retrieval timestamp. Verify both feeds against the official traffic site. A key may need separate product access for each feed.

For local development, set `TRANSPORT_VIC_API_KEY` in the environment before `npm run dev`, or use an untracked `.env.local` file with that server-only name. The Vite development middleware uses the same handler as the Worker. Without a key, the complete UI can still be reviewed. Vite's static preview has no API middleware; use `npm run dev` for the integrated local preview.

## Behavior

- Planned notices are filtered by sensor distance and overlap with the selected forecast hour, including recurring weekday and overnight work windows. Missing or malformed schedules are visibly uncertain. They are not given invented finish dates. Historical dates are not reconstructed from a current feed.
- Unexpected notices always describe current reported incidents, independently of the forecast slider. Inactive, reopened, pending and tow-allocation records are excluded. The v3 `endTime` may be the next update due; it is never used as a confirmed reopening time.
- Distance defaults to 1 km and can be changed to 500 m or 2 km. It measures proximity to the supplied road geometry, including line segments, rather than a walking route. Closures can be filtered separately.
- The browser checks once per minute while visible. The server caches planned results for 30 minutes and unexpected results for one minute, matching published source refresh periods, and coalesces concurrent requests. Failed requests have a one-minute backoff. Cloudflare Cache API shares successful results within a data centre; this is not a global rate limiter.
- Pagination uses `NextPageToken` for planned v1 and `meta.total_pages` for unplanned v3. A repeated/missing token, incomplete metadata or more than eight pages makes that feed unavailable rather than silently returning truncated coverage. Unplanned pages request up to 1,000 records. Each collection has a 15-second request deadline.
- A feed outage, missing key or stale retrieval is never presented as “no closures.” Missing geometry is counted as incomplete coverage. State and local road coverage is not a complete footpath/accessibility assessment. Pedestrian forecasts and recommendations are unchanged.

## Verified documentation, pending live authentication

Endpoints follow the downloadable official OpenAPI specifications:

- Planned: `https://api.opendata.transport.vic.gov.au/opendata/roads/disruptions/planned/v1/?format=GeoJson`
- Unplanned v3: `https://api.opendata.transport.vic.gov.au/api/opendata/roads/disruptions/unplanned/v3`

The planned portal summary names a `KeyID` header, while its OpenAPI names `Ocp-Apim-Subscription-Key`. The handler sends both header names to the same official host, with the same server secret. Unplanned uses `KeyId`. Redirects are rejected to avoid forwarding credentials to another host. Upstream error bodies and the key never appear in public responses.

**Actual authenticated responses remain unverified until a key is available.** Endpoint authentication, pagination and recurrence semantics should be checked against real notices before treating the feature as activated. Tests use explicit fixtures, not purported live data.
