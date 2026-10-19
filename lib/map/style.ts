import type { FilterSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";

// docs/specs/map-maplibre.md (MAPLIBRE-1, MAPLIBRE-2): the design's own
// MapLibre GL style, drawn in the design's dark, minimal palette with no
// labels and no icons, over OpenFreeMap's OpenMapTiles-schema vector tiles.
// No `glyphs`, no `sprite` and no symbol layer: the map draws no place names,
// road names or icons (owner decision, 2026-10-19).
//
// The colours mirror the `map-*` tokens in docs/design/system/tokens.json
// (and `--map-*` in app/globals.css). They are literals because a MapLibre
// paint property cannot read a CSS variable; lib/map/style.test.ts asserts
// each one equals its token, so a token change fails the test until this
// file follows it.
const MAP_GROUND = "#141416";
const MAP_WATER = "#111A22";
const MAP_ROAD_MINOR = "#1C1C20";
const MAP_ROAD = "#232327";
const MAP_ROAD_MAJOR = "#2B2B30";

/** The one tile source: OpenFreeMap's public instance (ADR 0023). */
const SOURCE = "openmaptiles";

const ROUND_LINES = { "line-cap": "round", "line-join": "round" } as const;

/**
 * MapLibre's own layer type, readable layer by layer without narrowing it
 * first: `paint` as a plain record, `source` and `filter` on every layer.
 * Still a `LayerSpecification`, so `mapStyle` is a `StyleSpecification`
 * and goes to `new Map({ style })` as it is.
 */
type MapStyleLayer = LayerSpecification & {
  source?: string;
  filter?: FilterSpecification;
  paint?: Record<string, unknown>;
};

interface MapStyle extends Omit<StyleSpecification, "layers"> {
  layers: MapStyleLayer[];
}

export const mapStyle: MapStyle = {
  version: 8,
  sources: {
    [SOURCE]: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
  },
  layers: [
    { id: "ground", type: "background", paint: { "background-color": MAP_GROUND } },
    {
      id: "water",
      type: "fill",
      source: SOURCE,
      "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": MAP_WATER },
    },
    {
      id: "waterway",
      type: "line",
      source: SOURCE,
      "source-layer": "waterway",
      minzoom: 8,
      paint: {
        "line-color": MAP_WATER,
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 14, 2],
      },
    },
    {
      id: "road-minor",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 11,
      filter: ["match", ["get", "class"], ["minor", "service"], true, false],
      layout: ROUND_LINES,
      paint: {
        "line-color": MAP_ROAD_MINOR,
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1, 14, 3, 17, 6],
      },
    },
    {
      id: "road",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 7,
      filter: ["match", ["get", "class"], ["primary", "secondary", "tertiary"], true, false],
      layout: ROUND_LINES,
      paint: {
        "line-color": MAP_ROAD,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.6, 12, 2.5, 16, 8],
      },
    },
    {
      id: "road-major",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      filter: ["match", ["get", "class"], ["motorway", "trunk"], true, false],
      layout: ROUND_LINES,
      paint: {
        "line-color": MAP_ROAD_MAJOR,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 8, 1.6, 12, 3.5, 16, 10],
      },
    },
    {
      id: "border",
      type: "line",
      source: SOURCE,
      "source-layer": "boundary",
      filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
      paint: {
        "line-color": MAP_ROAD_MAJOR,
        "line-width": 1,
        "line-dasharray": [3, 2],
      },
    },
  ],
};

/**
 * The attribution OpenFreeMap requires (MAPLIBRE-5), verbatim from the
 * `attribution` of its TileJSON (https://tiles.openfreemap.org/planet), so
 * MapLibre shows it once when the TileJSON's own copy arrives. It is not in
 * the source above (MAPLIBRE-2's test pins the source to its URL alone):
 * the map's attribution control carries it as its custom attribution.
 */
export const OPENFREEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';
