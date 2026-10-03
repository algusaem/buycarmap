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

// Default happy-path handlers. A test that needs a specific shape (error,
// empty, drift) overrides with `server.use(...)`.
//
// FRONT-5 (docs/specs/core-frontend.md) deleted the five proxy routes and the
// browser-bound fetchers that called them, so the local-proxy defaults that
// used to live here (`*/api/wallapop/search` and its siblings) are gone too —
// nothing calls those paths any more. A handful of tests still register a
// local override for one of those paths on purpose, to prove the negative
// (e.g. "no source API touched" in emails/emails.node.test.ts);
// that is unrelated to these shared defaults.
export const handlers = [
  // server/search/service.ts resolves coches.net's model id, and FRONT-4's
  // listCarModels its model list, by calling these upstreams directly — there
  // is no proxy route for either any more.
  http.get("https://api.wallapop.com/api/v3/search/filters/model", () =>
    HttpResponse.json({
      type: "model",
      id: "model",
      title: "Model",
      options: [{ id: "A3", title: "A3" }],
    }),
  ),
  http.get("https://web.gw.coches.net/models", () =>
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

  // ---- upstream APIs (consumed by server/search/service.ts's server-side fan-out) ----
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
