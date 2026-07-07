import { http, HttpResponse } from "msw";
import { makeWallapopItem, makeWallapopResponse } from "../fixtures/wallapop";
import {
  makeCochesNetItem,
  makeCochesNetResponse,
  makeCochesNetTaxonomy,
} from "../fixtures/cochesnet";

// Default happy-path handlers. Two audiences share this file:
//   - jsdom source clients hit the local proxy routes (`/api/...`).
//   - node route-handler tests hit the upstream APIs the proxy forwards to.
// A test that needs a specific shape (error, empty, drift) overrides with
// `server.use(...)`.
export const handlers = [
  // ---- local proxy routes (consumed by lib/*/client.ts in jsdom) ----
  http.get("*/api/wallapop/search", () =>
    HttpResponse.json(makeWallapopResponse([makeWallapopItem()], "page-2")),
  ),
  http.get("*/api/wallapop/filters/models", () =>
    HttpResponse.json({
      type: "model",
      id: "model",
      title: "Model",
      options: [{ id: "A3", title: "A3" }],
    }),
  ),
  http.post("*/api/cochesnet/search", () =>
    HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 3)),
  ),
  http.get("*/api/cochesnet/models", () =>
    HttpResponse.json(makeCochesNetTaxonomy([{ id: 4321, label: "Serie 3" }])),
  ),

  // ---- Nominatim geocoding (consumed by lib/geo/nominatim.ts) ----
  http.get("https://nominatim.openstreetmap.org/search", () =>
    HttpResponse.json([
      {
        place_id: 1,
        display_name: "Madrid, España",
        lat: "40.4168",
        lon: "-3.7038",
        address: { city: "Madrid", state: "Comunidad de Madrid" },
      },
    ]),
  ),

  // ---- upstream APIs (consumed by app/api/*/route.ts in node) ----
  http.get("https://api.wallapop.com/api/v3/search/section", () =>
    HttpResponse.json(makeWallapopResponse([makeWallapopItem()], "page-2")),
  ),
  http.post("https://web.gw.coches.net/search/listing", () =>
    HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 3)),
  ),
];
