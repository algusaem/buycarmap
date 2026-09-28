import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { makeWallapopResponse } from "@/test/fixtures/wallapop";
import { buildWallapopQuery, searchWallapop } from "./client";
import type { SearchInput } from "@/lib/validations/search";

// Capture the query string the client builds for the proxy route.
function captureQuery(): () => URLSearchParams {
  let captured = new URLSearchParams();
  server.use(
    http.get("*/api/wallapop/search", ({ request }) => {
      captured = new URL(request.url).searchParams;
      return HttpResponse.json(makeWallapopResponse([]));
    }),
  );
  return () => captured;
}

describe("searchWallapop", () => {
  it("SRC-8: always sends coordinates and constant category params", async () => {
    const params = captureQuery();
    await searchWallapop({});
    const q = params();

    expect(q.get("category_id")).toBe("100");
    expect(q.get("source")).toBe("deep_link");
    expect(q.get("section_type")).toBe("organic_search_results");
    expect(q.get("latitude")).toBe("40"); // Spain-center fallback
    expect(q.get("longitude")).toBe("-3.5");
  });

  it("orders by newest and uses a 1000km radius when no location is given", async () => {
    const params = captureQuery();
    await searchWallapop({});
    expect(params().get("order_by")).toBe("newest");
    expect(params().get("distance_in_km")).toBe("1000");
  });

  it("SRC-16: an explicit ordering overrides the located default", async () => {
    // The alert runner reads only page one, so a listing ranked twentieth by
    // relevance is one it never sees — and noticing new listings is the job.
    const q = buildWallapopQuery(
      { latitude: 41.38, longitude: 2.17, distanceInKm: 150 },
      { lat: 41.38, lng: 2.17, distance: 150, orderBy: "newest" },
    );

    expect(q.get("order_by")).toBe("newest");
  });

  it("SRC-16: without an override the located default still wins", async () => {
    const q = buildWallapopQuery(
      { latitude: 41.38, longitude: 2.17, distanceInKm: 150 },
      { lat: 41.38, lng: 2.17, distance: 150 },
    );

    // Relevance is right for a human reading a list; only the poller differs.
    expect(q.get("order_by")).toBe("most_relevance");
  });

  it("orders by relevance and honours the given radius when located", async () => {
    const params = captureQuery();
    await searchWallapop({ latitude: 41.38, longitude: 2.17, distanceInKm: 150 });
    const q = params();

    expect(q.get("order_by")).toBe("most_relevance");
    expect(q.get("latitude")).toBe("41.38");
    expect(q.get("longitude")).toBe("2.17");
    expect(q.get("distance_in_km")).toBe("150");
  });

  it("SRC-5: maps every provided filter to its Wallapop param name", async () => {
    const params = captureQuery();
    const input: SearchInput = {
      keywords: "gti",
      minPrice: 5000,
      maxPrice: 15000,
      minKm: 10_000,
      maxKm: 120_000,
      minYear: 2016,
      maxYear: 2021,
      minHorsePower: 90,
      maxHorsePower: 200,
      brand: "Volkswagen",
      model: "Golf",
      engine: ["gasoline", "gasoil"],
      gearbox: ["manual"],
      timeFilter: "today",
    };
    await searchWallapop(input);
    const q = params();

    expect(q.get("keywords")).toBe("gti");
    expect(q.get("min_sale_price")).toBe("5000");
    expect(q.get("max_sale_price")).toBe("15000");
    expect(q.get("min_km")).toBe("10000");
    expect(q.get("max_km")).toBe("120000");
    expect(q.get("min_year")).toBe("2016");
    expect(q.get("max_year")).toBe("2021");
    expect(q.get("min_horse_power")).toBe("90");
    expect(q.get("max_horse_power")).toBe("200");
    expect(q.get("brand")).toBe("Volkswagen");
    expect(q.get("model")).toBe("Golf");
    expect(q.get("engine")).toBe("gasoline,gasoil");
    expect(q.get("gearbox")).toBe("manual");
    expect(q.get("time_filter")).toBe("today");
  });

  it("forwards the next_page cursor for pagination", async () => {
    const params = captureQuery();
    await searchWallapop({}, "cursor-xyz");
    expect(params().get("next_page")).toBe("cursor-xyz");
  });

  it("SRC-13: throws when the proxy responds with a non-ok status", async () => {
    server.use(
      http.get("*/api/wallapop/search", () =>
        HttpResponse.json({ error: "boom" }, { status: 500 }),
      ),
    );
    await expect(searchWallapop({})).rejects.toThrow(/Wallapop API error: 500/);
  });
});
