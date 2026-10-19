# 0023 — MapLibre GL and OpenFreeMap vector tiles for the map

Status: Accepted · Date: 2026-10-19 · Supersedes in part [0007](0007-adopt-core-rules.md) › Dependencies outside `STACK.md` (`leaflet`, `react-leaflet`, `@types/leaflet`)

## Context

The BuyCarMap 2.0 design draws the map in its own palette: ground `map-ground` #141416, streets
`map-road` #232327, main roads `map-road-major` #2B2B30, small streets `map-road-minor` #1C1C20,
water `map-water` #111A22, almost no labels (`docs/design/system/tokens.json`,
`docs/design/system/README.md`). The app draws it with Leaflet over CARTO's raster `dark_all` tiles
(`components/map/ListingsMap.tsx`, MAP-23). A raster tile is a finished picture, so its colours and
labels cannot be changed: the map is the one screen that disagrees with the design (#118), and the
README and redesign images wait on it (#131).

CARTO has also stopped serving keyless tiles (its Basemaps terms of 29 September 2026), so the app
ships a public key, `NEXT_PUBLIC_CARTO_API_KEY`, protected only by a domain restriction.

Drawing the design's colours needs vector tiles, styled in the browser. The owner compared both maps
side by side on 2026-10-19 (a throwaway page: Leaflet + CARTO next to MapLibre + OpenFreeMap with the
design's palette and the price pins) and approved the proposal: «me mola mucho, acepto la nueva
sugerencia, está guapísima».

## Decided

- **`maplibre-gl`** draws the map, used directly, with no React wrapper. It replaces `leaflet`,
  `react-leaflet` and `@types/leaflet`, which leave the dependencies in the same change. The map
  components keep their own thin React layer, as today: a component owns one `maplibregl.Map` and
  syncs pins, the preview and the zone to it.
- **OpenFreeMap's public instance** serves the tiles (`https://tiles.openfreemap.org/planet`,
  OpenMapTiles schema): free, no key, no account, commercial use allowed, attribution to
  OpenMapTiles and OpenStreetMap required.
- **The style is ours**, a style object in the repository whose colours come from the `map-*` design
  tokens, with no label layer. The style names the tile source by one URL, so moving to another
  provider of the OpenMapTiles schema changes that URL and nothing else.
- `NEXT_PUBLIC_CARTO_API_KEY` leaves the env schema, and CARTO leaves `docs/privacy/processors.md`
  and the privacy page; OpenFreeMap takes its row.

The behaviour is specified in [docs/specs/map-maplibre.md](../specs/map-maplibre.md).

## What it beat

- **Keeping Leaflet and CARTO.** Cheaper and already tested, but the map can never match the design,
  and it depends on a key CARTO can rate or revoke.
- **A Leaflet vector-tile plugin** (`Leaflet.VectorGrid`, `protomaps-leaflet`). Keeps react-leaflet,
  but the plugins are thinly maintained, draw on canvas without the style spec, and still add a
  dependency.
- **`react-map-gl`** (vis.gl) over MapLibre. A declarative API like react-leaflet's, but a second
  dependency for what three effects in our own components already do.
- **MapTiler Cloud.** The same style works, with an SLA, but its free plan is for non-commercial use
  and the paid plan starts at 30 $/month (prices checked 2026-10-19).
- **Self-hosted Protomaps** (a PMTiles extract of Spain on Cloudflare R2, about 5 $/month). No third
  party in the path, but it needs an account, a deployment and a periodic rebuild. It stays the
  fallback if OpenFreeMap fails us (below).

## What it costs

- **Bundle.** About 296 KB gzip of JavaScript and 10 KB of CSS, against about 46 KB for Leaflet and
  react-leaflet (measured with `gzip -9` on the published files, 2026-10-19), loaded only by the
  pages with a map, through `next/dynamic` with `ssr: false` as today.
- **WebGL.** MapLibre needs it. Browsers without WebGL see no map (docs/specs/map-maplibre.md › Edge
  cases), and jsdom has none: component tests mock `maplibre-gl`, and what only a real map can prove
  (the preview's open and close lifecycle, today proven by rendering real Leaflet in jsdom) moves to
  Playwright.
- **A rewrite of the map layer.** Pins become `maplibregl.Marker`s with our own element, the preview a
  `maplibregl.Popup` holding the React card, the zone circle a GeoJSON layer, the zoom buttons call
  the map's own zoom. Every behaviour criterion of the map keeps binding, so their tests are ported,
  not rewritten. The visual baselines that show the map are retaken.
- **No SLA.** OpenFreeMap is run by one maintainer and funded by donations. If its tiles fail, the map
  shows its ground colour with the pins on it, and the search still works.
- **Zoom numbers change.** MapLibre's tiles are 512px where Leaflet's are 256px, so the same view is
  one zoom level lower; every zoom value in the code shifts by one.

## What would change our mind

- OpenFreeMap down or slow for users more than occasionally, or a change in its terms: move to
  self-hosted Protomaps (or MapTiler) by changing the source URL.
- The map pages' load time getting measurably worse on a mid-range phone because of the bundle.
- The design giving up its own map palette.

## See also

- [docs/specs/map-maplibre.md](../specs/map-maplibre.md)
- [docs/specs/map-and-search.md](../specs/map-and-search.md) › MAP-23 (withdrawn by MAPLIBRE)
- [0007](0007-adopt-core-rules.md) › Dependencies outside `STACK.md`
- [docs/privacy/processors.md](../privacy/processors.md)
