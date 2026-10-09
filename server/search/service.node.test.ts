import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { makeWallapopItem, makeWallapopResponse } from "@/test/fixtures/wallapop";
import { makeCochesNetItem, makeCochesNetResponse } from "@/test/fixtures/cochesnet";
import {
  makeMilanunciosAd,
  makeMilanunciosHtml,
  makeMilanunciosResponse,
} from "@/test/fixtures/milanuncios";
import { makeCriteria } from "@/test/fixtures/alerts";
import { EMPTY_SEARCH_CURSORS, fetchModelsForMake, searchRound } from "./service";
import type { SearchCursors } from "./schema";

// FRONT-1 (docs/specs/core-frontend.md). Same upstream URLs
// server/alerts/search.ts and server/alerts/search.node.test.ts already use —
// server/search/service.ts is the server-side fan-out those two share.
const WALLAPOP = "https://api.wallapop.com/api/v3/search/section";
const COCHESNET = "https://web.gw.coches.net/search/listing";
const COCHESNET_MODELS = "https://web.gw.coches.net/models";
const MILANUNCIOS = "https://www.milanuncios.com/*";

/** Resolves once `release()` is called; never before. */
function makeGate() {
  let release = () => {
    // Replaced below once the promise executor runs; never called as-is.
  };
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release: () => release() };
}

describe("searchRound", () => {
  it("FRONT-1: issues all three upstream requests before any of them resolves", async () => {
    const started = { wallapop: false, cochesNet: false, milanuncios: false };
    const wpGate = makeGate();
    // `makeCriteria()` sets both brand and model, so coches.net's *first*
    // request is the model-id lookup (`resolveCochesNetModelId`,
    // server/search/service.ts) — the search POST below waits on it and so
    // starts well after the other two sources' first requests. Gating the
    // lookup instead of the POST is what makes "every source has started"
    // true of its actual first request, not its second.
    const cnModelsGate = makeGate();
    const mnGate = makeGate();

    server.use(
      http.get(WALLAPOP, async () => {
        started.wallapop = true;
        await wpGate.promise;
        return HttpResponse.json(makeWallapopResponse([makeWallapopItem({ id: "wp-1" })]));
      }),
      http.get(COCHESNET_MODELS, async () => {
        started.cochesNet = true;
        await cnModelsGate.promise;
        return HttpResponse.json({ items: [] });
      }),
      http.post(COCHESNET, () =>
        HttpResponse.json(makeCochesNetResponse([makeCochesNetItem({ id: "cn-1" })], 1)),
      ),
      http.get(MILANUNCIOS, async () => {
        started.milanuncios = true;
        await mnGate.promise;
        return HttpResponse.html(
          makeMilanunciosHtml(makeMilanunciosResponse([makeMilanunciosAd({ id: "mn-1" })], 1)),
        );
      }),
    );

    const roundPromise = searchRound(makeCriteria(), EMPTY_SEARCH_CURSORS);

    // Flush the event loop so every source's first request has had a chance
    // to start, without letting any of the three gated handlers resolve yet.
    // coches.net's first request is behind one more real `await` than the
    // other two (the makeId lookup happens before the fetch call itself), so
    // a macrotask flush is used rather than a fixed number of microtask ticks.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(started).toEqual({ wallapop: true, cochesNet: true, milanuncios: true });

    wpGate.release();
    cnModelsGate.release();
    mnGate.release();

    await roundPromise;
  });

  it("FRONT-1: always sends the Wallapop request with the chosen coordinates", async () => {
    let captured = new URLSearchParams();
    server.use(
      http.get(WALLAPOP, ({ request }) => {
        captured = new URL(request.url).searchParams;
        return HttpResponse.json(makeWallapopResponse([makeWallapopItem()]));
      }),
      http.post(COCHESNET, () =>
        HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 1)),
      ),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(makeMilanunciosHtml(makeMilanunciosResponse([makeMilanunciosAd()], 1))),
      ),
    );

    await searchRound(makeCriteria(), EMPTY_SEARCH_CURSORS);

    // makeCriteria() fixes latitude/longitude at Madrid (40.4168, -3.7038).
    expect(captured.get("latitude")).toBe("40.4168");
    expect(captured.get("longitude")).toBe("-3.7038");
  });

  it("FRONT-1: a coches.net 503 reports it as failed, keeps its cursor unchanged, and still returns the other two sources", async () => {
    server.use(
      http.get(WALLAPOP, () =>
        HttpResponse.json(makeWallapopResponse([makeWallapopItem({ id: "wp-1" })])),
      ),
      http.post(COCHESNET, () => new HttpResponse(null, { status: 503 })),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(
          makeMilanunciosHtml(makeMilanunciosResponse([makeMilanunciosAd({ id: "mn-1" })], 1)),
        ),
      ),
    );

    const round = await searchRound(makeCriteria(), EMPTY_SEARCH_CURSORS);

    expect(round.failedSources).toEqual(["Coches.net"]);
    expect(round.listings.some((l) => l.source === "Wallapop")).toBe(true);
    expect(round.listings.some((l) => l.source === "Milanuncios")).toBe(true);
    expect(round.listings.some((l) => l.source === "Coches.net")).toBe(false);
    // The round made no progress for coches.net, so a retry has to ask for
    // the same page again rather than skipping ahead.
    expect(round.cursors.cochesNet).toBe(EMPTY_SEARCH_CURSORS.cochesNet);
  });

  // docs/specs/data-sources.md: SRC-5, SRC-7, SRC-8, SRC-13 moved here from
  // the deleted lib/*/client.ts `searchWallapop`/`searchCochesNet`/
  // `searchMilanuncios` and lib/cochesnet/models.ts tests (FRONT-5) — this is
  // the only place left that actually drives the upstream fetch.

  it("SRC-8: always sends coordinates and constant category params to Wallapop", async () => {
    let captured = new URLSearchParams();
    server.use(
      http.get(WALLAPOP, ({ request }) => {
        captured = new URL(request.url).searchParams;
        return HttpResponse.json(makeWallapopResponse([makeWallapopItem()]));
      }),
      http.post(COCHESNET, () =>
        HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 1)),
      ),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(makeMilanunciosHtml(makeMilanunciosResponse([makeMilanunciosAd()], 1))),
      ),
    );

    await searchRound({}, EMPTY_SEARCH_CURSORS);

    expect(captured.get("category_id")).toBe("100");
    expect(captured.get("source")).toBe("deep_link");
    expect(captured.get("section_type")).toBe("organic_search_results");
    // Spain-center fallback — no location was chosen.
    expect(captured.get("latitude")).toBe("40");
    expect(captured.get("longitude")).toBe("-3.5");
  });

  it("SRC-7: falls back to make-only filtering when the model name matches nothing on coches.net", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.get(WALLAPOP, () => HttpResponse.json(makeWallapopResponse([makeWallapopItem()]))),
      http.post(COCHESNET, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 1));
      }),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(makeMilanunciosHtml(makeMilanunciosResponse([makeMilanunciosAd()], 1))),
      ),
      // Seat → makeId 39; model list lacks the requested name.
      http.get("https://web.gw.coches.net/models", () =>
        HttpResponse.json({ items: [{ id: 1, label: "Leon" }] }),
      ),
    );

    await searchRound(makeCriteria({ brand: "Seat", model: "Nonexistent" }), EMPTY_SEARCH_CURSORS);

    const filters = body.filters as { vehicles?: { makeId: number; modelId?: number }[] };
    expect(filters.vehicles).toEqual([{ makeId: 39 }]);
  });

  it("SRC-13: a non-ok Wallapop response is treated as a failed source, not an empty one", async () => {
    server.use(
      http.get(WALLAPOP, () => new HttpResponse(null, { status: 500 })),
      http.post(COCHESNET, () =>
        HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 1)),
      ),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(makeMilanunciosHtml(makeMilanunciosResponse([makeMilanunciosAd()], 1))),
      ),
    );

    const round = await searchRound(makeCriteria(), EMPTY_SEARCH_CURSORS);

    expect(round.failedSources).toEqual(["Wallapop"]);
    expect(round.listings.some((l) => l.source === "Wallapop")).toBe(false);
  });

  it("SRC-9: sends the headers each upstream refuses to answer without", async () => {
    let wallapopHeaders = new Headers();
    let cochesNetHeaders = new Headers();
    server.use(
      http.get(WALLAPOP, ({ request }) => {
        wallapopHeaders = request.headers;
        return HttpResponse.json(makeWallapopResponse([makeWallapopItem()]));
      }),
      http.post(COCHESNET, ({ request }) => {
        cochesNetHeaders = request.headers;
        return HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 1));
      }),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(makeMilanunciosHtml(makeMilanunciosResponse([makeMilanunciosAd()], 1))),
      ),
    );

    await searchRound(makeCriteria(), EMPTY_SEARCH_CURSORS);

    expect(wallapopHeaders.get("x-deviceos")).toBe("0");
    expect(wallapopHeaders.get("x-appversion")).toBe("85000");
    expect(cochesNetHeaders.get("x-schibsted-tenant")).toBe("coches");
  });

  it("SRC-12: a rejected upstream connection is a failed source, not a thrown error", async () => {
    server.use(
      http.get(WALLAPOP, () => HttpResponse.error()),
      http.post(COCHESNET, () =>
        HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 1)),
      ),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(makeMilanunciosHtml(makeMilanunciosResponse([makeMilanunciosAd()], 1))),
      ),
    );

    const round = await searchRound(makeCriteria(), EMPTY_SEARCH_CURSORS);

    expect(round.failedSources).toContain("Wallapop");
  });

  it("SRC-10: an empty make contacts no upstream and resolves to no models", async () => {
    const calls: string[] = [];
    server.use(
      http.get("https://api.wallapop.com/api/v3/search/filters/model", ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json({ type: "model", id: "model", title: "Model", options: [] });
      }),
      http.get("https://web.gw.coches.net/models", ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json({ items: [] });
      }),
    );

    const models = await fetchModelsForMake("");

    expect(models).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("SRC-11: every source's non-ok response is reported as a failure, not silently dropped", async () => {
    server.use(
      http.get(WALLAPOP, () => HttpResponse.json(makeWallapopResponse([makeWallapopItem()]))),
      http.post(COCHESNET, () =>
        HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 1)),
      ),
      http.get(MILANUNCIOS, () => new HttpResponse(null, { status: 503 })),
    );

    const round = await searchRound(makeCriteria(), EMPTY_SEARCH_CURSORS);

    expect(round.failedSources).toEqual(["Milanuncios"]);
  });

  it("MAP-24: a Wallapop next_page equal to an already-requested cursor reports Wallapop exhausted, keeping the page's listings", async () => {
    server.use(
      http.get(WALLAPOP, ({ request }) => {
        const next = new URL(request.url).searchParams.get("next_page");
        expect(next).toBe("c2");
        return HttpResponse.json(makeWallapopResponse([makeWallapopItem({ id: "wp-a" })], "c1"));
      }),
      http.post(COCHESNET, () =>
        HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 5)),
      ),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(makeMilanunciosHtml(makeMilanunciosResponse([makeMilanunciosAd()], 5))),
      ),
    );
    const cursors: SearchCursors = {
      wallapop: "c2",
      wallapopRequested: ["c1"],
      cochesNet: 2,
      milanuncios: 0,
    };

    const round = await searchRound({}, cursors);

    expect(round.listings.some((l) => l.id === "wallapop-wp-a")).toBe(true);
    expect(round.cursors).toEqual({
      wallapop: null,
      wallapopRequested: ["c1", "c2"],
      cochesNet: 3,
      milanuncios: 1,
    });
    expect(round.hasMore.Wallapop).toBe(false);
  });

  it("MAP-24: a failed Wallapop request leaves its cursor and its requested-cursor history unchanged", async () => {
    server.use(
      http.get(WALLAPOP, () => new HttpResponse(null, { status: 500 })),
      http.post(COCHESNET, () =>
        HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 5)),
      ),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(makeMilanunciosHtml(makeMilanunciosResponse([makeMilanunciosAd()], 5))),
      ),
    );
    const cursors: SearchCursors = {
      wallapop: "c2",
      wallapopRequested: ["c1"],
      cochesNet: 2,
      milanuncios: 0,
    };

    const round = await searchRound({}, cursors);

    expect(round.cursors.wallapop).toBe("c2");
    expect(round.cursors.wallapopRequested).toEqual(["c1"]);
  });

  it("SRC-14: a failed model lookup does not disable a later lookup for the same brand", async () => {
    let attempts = 0;
    server.use(
      http.get("https://web.gw.coches.net/models", () => {
        attempts += 1;
        if (attempts === 1) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json({ items: [{ id: 501, label: "Ibiza" }] });
      }),
      http.get("https://api.wallapop.com/api/v3/search/filters/model", () =>
        HttpResponse.json({ type: "model", id: "model", title: "Model", options: [] }),
      ),
    );

    const first = await fetchModelsForMake("Seat");
    expect(first).toEqual([]); // the failed lookup degrades, rather than throwing

    const second = await fetchModelsForMake("Seat");
    expect(second.map((m) => m.label)).toContain("Ibiza"); // not disabled by the earlier failure
  });
});
