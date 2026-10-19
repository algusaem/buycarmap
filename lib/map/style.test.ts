import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapStyle } from "./style";

// docs/specs/map-maplibre.md (MAPLIBRE-1, MAPLIBRE-2): the design's own
// MapLibre style, drawn in the design's palette with no labels. The colours
// below are the spec's worked example "Colours (MAPLIBRE-1)", cross-checked
// against docs/design/system/tokens.json by this file itself (not assumed).
//
// `process.cwd()` rather than `import.meta.url`: Vitest's jsdom "unit"
// project does not hand this file a `file:` URL, so `fileURLToPath` throws;
// `vitest.config.ts` runs every project from the repo root.
const TOKENS_PATH = join(process.cwd(), "docs/design/system/tokens.json");

function readToken(name: string): string {
  const tokens = JSON.parse(readFileSync(TOKENS_PATH, "utf8")) as {
    color: { tokens: Array<{ name: string; value: string }> };
  };
  const token = tokens.color.tokens.find((entry) => entry.name === name);
  if (!token) throw new Error(`token "${name}" not found in tokens.json`);
  return token.value;
}

// Worked example "Colours (MAPLIBRE-1)", docs/specs/map-maplibre.md.
const MAP_GROUND = "#141416";
const MAP_WATER = "#111A22";
const MAP_ROAD_MINOR = "#1C1C20";
const MAP_ROAD = "#232327";
const MAP_ROAD_MAJOR = "#2B2B30";

describe("MAPLIBRE-1: lib/map/style.ts draws the design's layers in order and colour", () => {
  it("MAPLIBRE-1: the literal colours above equal the map-* tokens in tokens.json", () => {
    // Guards the constants above against the token file drifting out from
    // under them: if this fails, the literals, not the style, are wrong.
    expect(readToken("map-ground")).toBe(MAP_GROUND);
    expect(readToken("map-water")).toBe(MAP_WATER);
    expect(readToken("map-road-minor")).toBe(MAP_ROAD_MINOR);
    expect(readToken("map-road")).toBe(MAP_ROAD);
    expect(readToken("map-road-major")).toBe(MAP_ROAD_MAJOR);
  });

  it("MAPLIBRE-1: draws ground, water, waterway, road-minor, road, road-major, border in that order", () => {
    const order = mapStyle.layers.map((layer) => ({ id: layer.id, type: layer.type }));

    expect(order).toEqual([
      { id: "ground", type: "background" },
      { id: "water", type: "fill" },
      { id: "waterway", type: "line" },
      { id: "road-minor", type: "line" },
      { id: "road", type: "line" },
      { id: "road-major", type: "line" },
      { id: "border", type: "line" },
    ]);
  });

  function layer(id: string) {
    const found = mapStyle.layers.find((candidate) => candidate.id === id);
    expect(found, `layer "${id}" exists`).toBeDefined();
    return found;
  }

  it("MAPLIBRE-1: the ground is a background layer painted map-ground, with no minzoom", () => {
    const ground = layer("ground");
    expect(ground?.paint?.["background-color"]).toBe(MAP_GROUND);
    expect(ground?.minzoom).toBeUndefined();
  });

  it("MAPLIBRE-1: water is a fill layer painted map-water, from zoom 0", () => {
    const water = layer("water");
    expect(water?.paint?.["fill-color"]).toBe(MAP_WATER);
  });

  it("MAPLIBRE-1: waterway is a line layer painted map-water, visible from zoom 8", () => {
    const waterway = layer("waterway");
    expect(waterway?.paint?.["line-color"]).toBe(MAP_WATER);
    expect(waterway?.minzoom).toBe(8);
  });

  it("MAPLIBRE-1: road-minor is a line layer painted map-road-minor, visible from zoom 11, for minor and service streets only", () => {
    const roadMinor = layer("road-minor");
    expect(roadMinor?.paint?.["line-color"]).toBe(MAP_ROAD_MINOR);
    expect(roadMinor?.minzoom).toBe(11);

    const filterText = JSON.stringify(roadMinor?.filter ?? []);
    for (const included of ["minor", "service"]) {
      expect(filterText, `filter includes "${included}"`).toContain(included);
    }
    for (const excluded of ["primary", "secondary", "tertiary", "motorway", "trunk"]) {
      expect(filterText, `filter excludes "${excluded}"`).not.toContain(excluded);
    }
  });

  it("MAPLIBRE-1: road is a line layer painted map-road, visible from zoom 7, for primary/secondary/tertiary only", () => {
    const road = layer("road");
    expect(road?.paint?.["line-color"]).toBe(MAP_ROAD);
    expect(road?.minzoom).toBe(7);

    const filterText = JSON.stringify(road?.filter ?? []);
    for (const included of ["primary", "secondary", "tertiary"]) {
      expect(filterText, `filter includes "${included}"`).toContain(included);
    }
    for (const excluded of ["minor", "service", "motorway", "trunk"]) {
      expect(filterText, `filter excludes "${excluded}"`).not.toContain(excluded);
    }
  });

  it("MAPLIBRE-1: road-major is a line layer painted map-road-major, for motorways and trunk roads only", () => {
    const roadMajor = layer("road-major");
    expect(roadMajor?.paint?.["line-color"]).toBe(MAP_ROAD_MAJOR);

    const filterText = JSON.stringify(roadMajor?.filter ?? []);
    for (const included of ["motorway", "trunk"]) {
      expect(filterText, `filter includes "${included}"`).toContain(included);
    }
    for (const excluded of ["minor", "service", "primary", "secondary", "tertiary"]) {
      expect(filterText, `filter excludes "${excluded}"`).not.toContain(excluded);
    }
  });

  it("MAPLIBRE-1: border is a dashed line layer painted map-road-major, land country borders only", () => {
    const border = layer("border");
    expect(border?.paint?.["line-color"]).toBe(MAP_ROAD_MAJOR);
    // Dashed: MapLibre draws a dash pattern only when line-dasharray is set.
    expect(border?.paint?.["line-dasharray"]).toBeDefined();

    const filterText = JSON.stringify(border?.filter ?? []);
    expect(filterText, "filter references admin_level").toContain("admin_level");
    expect(filterText, "filter references the land boundary level (2)").toContain("2");
    expect(filterText, "filter references maritime").toContain("maritime");
  });

  it("MAPLIBRE-1: the style holds no other colour than the five map-* tokens", () => {
    const colorValues = new Set<string>();
    for (const styleLayer of mapStyle.layers) {
      for (const [property, value] of Object.entries(styleLayer.paint ?? {})) {
        if (property.endsWith("-color") && typeof value === "string") {
          colorValues.add(value.toLowerCase());
        }
      }
    }

    const expected = new Set(
      [MAP_GROUND, MAP_WATER, MAP_ROAD_MINOR, MAP_ROAD, MAP_ROAD_MAJOR].map((hex) =>
        hex.toLowerCase(),
      ),
    );
    expect(colorValues).toEqual(expected);
  });
});

describe("MAPLIBRE-2: the style has exactly one vector source and draws no labels", () => {
  it("MAPLIBRE-2: holds exactly one source, OpenFreeMap's OpenMapTiles-schema vector tiles", () => {
    const sourceKeys = Object.keys(mapStyle.sources);
    expect(sourceKeys).toHaveLength(1);
    expect(mapStyle.sources[sourceKeys[0]]).toEqual({
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
    });
  });

  it("MAPLIBRE-2: every non-background layer draws from that one source", () => {
    const sourceKeys = Object.keys(mapStyle.sources);
    const [sourceKey] = sourceKeys;
    const nonBackgroundLayers = mapStyle.layers.filter((layer) => layer.type !== "background");

    expect(nonBackgroundLayers.length).toBeGreaterThan(0);
    for (const styleLayer of nonBackgroundLayers) {
      expect(styleLayer.source, `layer "${styleLayer.id}" names a source`).toBe(sourceKey);
    }
  });

  it("MAPLIBRE-2: declares no glyphs or sprite URL, and no symbol layer", () => {
    expect(mapStyle.glyphs).toBeUndefined();
    expect(mapStyle.sprite).toBeUndefined();
    expect(mapStyle.layers.some((layer) => layer.type === "symbol")).toBe(false);
  });
});
