import type { Page } from "@playwright/test";

// docs/specs/map-maplibre.md (Contracts › Tiles). Every e2e test that draws a
// MapLibre map stubs OpenFreeMap's two endpoints so a run never reaches the
// real host: the TileJSON the style's one source points at
// (https://tiles.openfreemap.org/planet), and the actual tile requests under
// it (https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf). With `failTiles`
// both are aborted instead, for MAPLIBRE-14 (OpenFreeMap down).

const TILEJSON = {
  tilejson: "3.0.0",
  tiles: ["https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf"],
  minzoom: 0,
  maxzoom: 14,
  vector_layers: [],
};

/** The pages already stubbed: the first stub a page gets is the one it keeps. */
const stubbedPages = new WeakSet<Page>();

/**
 * Stubs OpenFreeMap's TileJSON and tile requests so no e2e run ever reaches
 * the real host. With `failTiles`, every request to either endpoint is
 * aborted, as OpenFreeMap being down would look to the browser (MAPLIBRE-14):
 * the style can draw only its background colour, with no water or road data.
 *
 * `mockListingSources` (e2e/fixtures/network.ts) and the specs' own
 * `beforeEach` call it on every page too, so a later call on a page already
 * stubbed changes nothing: a test's `failTiles` stub, set first, stays.
 */
export async function stubMapTiles(
  page: Page,
  { failTiles = false }: { failTiles?: boolean } = {},
): Promise<void> {
  if (stubbedPages.has(page)) return;
  stubbedPages.add(page);
  await page.route("https://tiles.openfreemap.org/planet", async (route) => {
    if (failTiles) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({ json: TILEJSON });
  });

  await page.route("https://tiles.openfreemap.org/planet/**", async (route) => {
    if (failTiles) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({ status: 204, body: "" });
  });
}
