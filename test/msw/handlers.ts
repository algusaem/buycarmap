import { http, HttpResponse } from "msw";
import { makeWallapopItem, makeWallapopResponse } from "../fixtures/wallapop";
import {
  makeCochesNetItem,
  makeCochesNetResponse,
  makeCochesNetTaxonomy,
} from "../fixtures/cochesnet";
import {
  makeMilanunciosAd,
  makeMilanunciosHtml,
  makeMilanunciosResponse,
} from "../fixtures/milanuncios";

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
  http.get("*/api/milanuncios/search", () =>
    HttpResponse.json(makeMilanunciosResponse([makeMilanunciosAd()], 5)),
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
  http.get("https://www.milanuncios.com/*", () =>
    HttpResponse.html(makeMilanunciosHtml(makeMilanunciosResponse([makeMilanunciosAd()], 5))),
  ),

  // ---- Have I Been Pwned range API (consumed by lib/auth/pwned.ts) ----
  // Default: the password is clean. The suffixes below are arbitrary and will
  // not match any real hash, so `findSuffix` returns 0. A test that needs a
  // breached password overrides this with `server.use(...)` and echoes back the
  // suffix of the hash it expects.
  http.get("https://api.pwnedpasswords.com/range/*", () =>
    HttpResponse.text(
      "0018A45C4D1DEF81644B54AB7F969B88D65:1\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2",
    ),
  ),
];
