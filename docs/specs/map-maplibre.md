# Map — the design's own map style, drawn with MapLibre GL and OpenFreeMap

Key: MAPLIBRE
Status: Implemented
Last updated: 2026-10-19

---

## Problem

The BuyCarMap 2.0 design draws the map in its own dark, minimal palette with almost no labels
(`docs/design/system/tokens.json` › `map-*`, `docs/design/system/README.md`). The app draws it with
Leaflet over CARTO's raster `dark_all` tiles (`components/map/ListingsMap.tsx`,
`components/alerts/ZoneMapCanvas.tsx`, MAP-23). A raster tile is a finished picture: its greys, its
roads and its labels are CARTO's and cannot be recoloured, so the map is the one screen that
disagrees with the design (#118). The README and redesign images wait on it (#131). CARTO also no
longer serves tiles without a key, so the app ships a public key protected only by a domain
restriction.

The owner compared both maps side by side on 2026-10-19 and approved drawing the map with MapLibre GL
and OpenFreeMap's vector tiles, styled with the design's tokens
([ADR 0023](../decisions/0023-maplibre-openfreemap.md)).

In scope:

- the map style: the design's colours, no labels;
- the engine swap on every map: the search map (`/map`), the alert page (`/alerts/[id]`), the saved
  cars page (`/favorites`) and the phone zone preview of the alerts list;
- keeping every behaviour the maps have today: pins, the preview card, the zone, the zoom buttons,
  fitting to results, keyboard use, the phone sheet;
- the tile provider's footprint: CSP, env schema, processors, the privacy page.

## Acceptance criteria

The style

- [x] MAPLIBRE-1 · unit — The map style (`lib/map/style.ts`) draws, in this order: the ground in
  `map-ground`; water areas and, from zoom 8, waterways in `map-water`; from zoom 11, minor and
  service streets in `map-road-minor`; from zoom 7, primary, secondary and tertiary roads in
  `map-road`; motorways and trunk roads in `map-road-major`; and land country borders as a dashed
  line in `map-road-major`. Each colour equals the token's value in
  `docs/design/system/tokens.json`, and the style holds no other colour.
- [x] MAPLIBRE-2 · unit — The style has exactly one source, a vector source of the OpenMapTiles
  schema at `https://tiles.openfreemap.org/planet`, and no label layer and no `glyphs` or `sprite`
  URL, so the map draws no place names, road names or icons.
- [x] MAPLIBRE-3 · e2e — At 1440 × 900 on `/map`, with no search yet, the map shows mainland Spain
  centred as today: centre 40.4168, −3.7038 at MapLibre zoom 5 (Leaflet zoom 6). The ground pixel
  at the map's centre-left over land is `rgb(20, 20, 22)` (#141416), and no request goes to
  `cartocdn.com`.
- [x] MAPLIBRE-4 · e2e — The map can be panned and zoomed but never rotated or tilted: a right-drag, a
  Ctrl-drag and a two-finger twist leave the bearing and the pitch at 0.
- [x] MAPLIBRE-5 · e2e — The map shows the attribution OpenFreeMap requires, «OpenFreeMap ©
  OpenMapTiles Data from OpenStreetMap», each name a link to its site, in the compact control at the
  bottom right, in the theme's colours (`surface` background, `text-muted` text). The phone zone
  preview keeps its plain-text attribution with no link and nothing focusable (ALERTUI-24), with the
  same three names.

The same map, on the new engine

- [x] MAPLIBRE-6 · e2e — Every criterion the maps satisfy today keeps binding, with its existing
  test ported to the new engine and not weakened: the price pins and their grouping (MAP-15,
  MAPUI-25), the active pin, the desktop preview card and its open, close, focus and Escape lifecycle,
  the zoom buttons (MAPUI-29), fitting to a new search's first results only (MAP-25), the alert
  zone (`components/map/ZoneLayers.tsx`, redesign-alerts.md), the phone zone preview (ALERTUI-24),
  and the phone results sheet's drag (MAPUI-58 to MAPUI-62). Where one of those tests names a
  Leaflet class or API, it names the MapLibre equivalent instead.
- [x] MAPLIBRE-7 · e2e — A new search's first results fit the map with 56px of padding on every side
  and a maximum MapLibre zoom of 13 (Leaflet's 14), so every pin and its focus outline sit wholly
  inside the map; the reset view of an empty search is the default view of MAPLIBRE-3. (amended
  2026-10-20, bug fix: with 40px, half of an 86px-wide pin, the end pins were cut by 3px — A11Y-4)
- [x] MAPLIBRE-8 · e2e — The pins stay keyboard-operable as today: each is a button with its
  accessible name, Tab reaches them in the order they are today, Enter or Space on a pin opens its
  preview on desktop at once, Escape closes it and focus returns to the pin.
- [x] MAPLIBRE-9 · e2e — On a phone, dragging the results sheet's handle or header moves the sheet and
  does not pan the map, and panning the map does not move the sheet.

Where the map's code and data go

- [x] MAPLIBRE-10 · e2e — `maplibre-gl` loads only on a page that shows a map: opening `/` and
  `/login` downloads no MapLibre script, and the map component is still loaded with `next/dynamic`
  and `ssr: false`.
- [x] MAPLIBRE-11 · node — The Content Security Policy built by `proxy.ts` allows
  `https://tiles.openfreemap.org` in `connect-src` (style, tiles) and `blob:` in `worker-src` (the
  map's web worker), and no longer allows `*.basemaps.cartocdn.com`.
- [x] MAPLIBRE-12 · node — `lib/env.ts` no longer declares `NEXT_PUBLIC_CARTO_API_KEY`; its `client`
  block holds only `NEXT_PUBLIC_SENTRY_DSN` (amends PLAT-1), and no source file reads the CARTO key.
- [x] MAPLIBRE-13 · component — The privacy page names OpenFreeMap where it named CARTO, with the
  exact sentences under Worked examples, in both locales (amends FRONT-27), and
  `docs/privacy/processors.md` has an OpenFreeMap row in place of CARTO's.

When the map cannot draw

- [x] MAPLIBRE-14 · e2e — When every tile request fails (OpenFreeMap down), the map shows its ground
  colour with the pins on it, the pins and the preview still work, and the list and the search are
  unaffected; no error reaches the user.

- [x] MAPLIBRE-15 · e2e — In a browser without WebGL, every map area shows the empty map ground
  (`map-ground`, no pins, no zoom buttons) with the StatusPill «El mapa no está disponible en este
  navegador» / «The map isn't available in this browser» over it, as designed in
  `docs/design/canvas/F0-estado-mapa-no-disponible.dc.html`; the list, the search, the filters and
  the preview-free list actions keep working, and no error reaches the console unhandled. The phone
  zone preview of the alerts list shows the ground alone, with no pill.

`MAP-23` (the CARTO tile URL and its key) is withdrawn by this spec: there is no tile URL left to
build.

## Worked examples

**Colours (MAPLIBRE-1)**, from `docs/design/system/tokens.json`:

| Layer | Token | Value |
| --- | --- | --- |
| ground (background) | `map-ground` | #141416 |
| water, waterway | `map-water` | #111A22 |
| minor and service streets | `map-road-minor` | #1C1C20 |
| primary, secondary, tertiary roads | `map-road` | #232327 |
| motorway, trunk | `map-road-major` | #2B2B30 |
| country border (land only, dashed) | `map-road-major` | #2B2B30 |

**Zoom (MAPLIBRE-3, MAPLIBRE-7).** MapLibre's tiles are 512px and Leaflet's 256px, so the same view is
one zoom level lower:

| View | Leaflet today | MapLibre |
| --- | --- | --- |
| default (Spain) | centre 40.4168, −3.7038, zoom 6 | same centre, zoom 5 |
| fit to results | padding 40px, max zoom 14 | padding 56px (amended 2026-10-20), max zoom 13 |
| phone zone preview | `paddingTopLeft` [80, 26], `paddingBottomRight` [0, 26] | padding top 26, left 80, right 0, bottom 26 |

**Privacy page (MAPLIBRE-13).** In «Third-party services» / «Servicios de terceros», only the CARTO
clause changes; the rest of each body and `updated` stay as FRONT-27 has them, with `updated` moved to
the date this ships:

- EN, before: «CARTO (map tiles) receives tile requests straight from your browser, which show the
  area you are viewing;»
- EN, after: «OpenFreeMap (map tiles) receives tile requests straight from your browser, which show
  the area you are viewing;»
- ES, before: «CARTO (teselas del mapa) recibe las peticiones de teselas directamente desde tu
  navegador, que revelan la zona que estás viendo;»
- ES, after: «OpenFreeMap (teselas del mapa) recibe las peticiones de teselas directamente desde tu
  navegador, que revelan la zona que estás viendo;»

## Data model

None. No table, column or stored value changes.

## Permissions

None. The maps are public as today; the pages that show them keep their own rules.

## Edge cases

- **OpenFreeMap down or slow** (MAPLIBRE-14): ground colour and pins, nothing else breaks.
- **No WebGL** (very old browsers, some locked-down machines): MapLibre cannot start; the map area
  says so and the rest of the page works (MAPLIBRE-15).
- **High-density screens:** vector tiles stay sharp at every zoom, where raster tiles blurred.
- **Many pins:** unchanged from today; clustering stays out of scope ([0007](../decisions/0007-adopt-core-rules.md) › Not accepted).
- **The phone zone preview** stays static: no pan, zoom, keyboard or focusable element (ALERTUI-24).

## Out of scope

- Place or road names on the map (owner decision 2026-10-19).
- Clustering pins.
- Self-hosting tiles (Protomaps); it stays the fallback in ADR 0023.
- Retaking the README and redesign images (#131), which follow once this ships.
- A light map style; the app has one dark theme.

## Contracts

- **Tiles:** `https://tiles.openfreemap.org/planet` (TileJSON), OpenMapTiles schema layers `water`,
  `waterway`, `transportation` (`class`: `minor`, `service`, `primary`, `secondary`, `tertiary`,
  `motorway`, `trunk`), `boundary` (`admin_level` 2, `maritime` ≠ 1). No key, no account.
- **Dependency:** `maplibre-gl` (current 6.x, pinned at install); `leaflet`, `react-leaflet` and
  `@types/leaflet` leave `package.json` in the same change ([ADR 0023](../decisions/0023-maplibre-openfreemap.md)).
- **Test hooks:** each map's container carries `data-map` (`listings` for the search, saved and
  alert maps, `zone` for the phone zone preview) and, updated on every `moveend`,
  `data-map-center` (`lat,lng`, 4 decimals), `data-map-zoom`, `data-map-bearing` and
  `data-map-pitch` (2 decimals, trailing zeros trimmed), so the e2e tests can read the view.
- **Manual action after merging:** delete `NEXT_PUBLIC_CARTO_API_KEY` from the Vercel environments,
  and the key in the CARTO dashboard.

## Decisions and rationale

- **The engine and the provider** are ADR 0023's decision, approved by the owner on 2026-10-19 after
  comparing both maps side by side.
- **No labels, not even city names.** The design says «casi sin etiquetas» and draws none on any
  map screen; the owner approved the comparison with the city names off and confirmed «sin nombres
  de ciudades» on 2026-10-19, so the style needs no glyphs.
- **No WebGL** gets the empty map with a StatusPill, the pattern the empty and loading states
  already use over the map (`docs/design/system/components/EmptyState/README.md`), approved by the
  owner on 2026-10-19 on condition that it is designed first; the design is
  `F0-estado-mapa-no-disponible.dc.html`.
- **No React wrapper.** Each map component owns one `maplibregl.Map` and syncs pins, the preview and
  the zone to it, as react-leaflet did for us; a wrapper library would be a second dependency for
  that.
- **Tests.** jsdom has no WebGL, so component tests mock `maplibre-gl` and assert what our code asks
  of it; what only a drawn map proves (pixels, the preview's lifecycle, gestures) is e2e. The one
  test file that rendered real Leaflet in jsdom, for the preview's lifecycle, moved to Playwright
  (`e2e/map.spec.ts`, under the same criterion ids).
