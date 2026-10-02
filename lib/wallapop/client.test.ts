import { describe, expect, it } from "vitest";
import { buildWallapopQuery } from "./client";
import type { SearchInput } from "@/lib/search/schema";

// FRONT-5 (docs/specs/core-frontend.md): `searchWallapop`, the browser-bound
// fetcher that called the (deleted) `/api/wallapop/search` proxy, is gone.
// `buildWallapopQuery` is the pure, reusable part — server/search/service.ts
// is its only caller now — and stays fully covered here without any network.

describe("buildWallapopQuery", () => {
  it("SRC-8: always sends coordinates and constant category params", () => {
    const q = buildWallapopQuery({}, { lat: 40, lng: -3.5, distance: 1000 });

    expect(q.get("category_id")).toBe("100");
    expect(q.get("source")).toBe("deep_link");
    expect(q.get("section_type")).toBe("organic_search_results");
    expect(q.get("latitude")).toBe("40");
    expect(q.get("longitude")).toBe("-3.5");
  });

  it("orders by newest and honours the given radius when no location is given", () => {
    const q = buildWallapopQuery({}, { lat: 40, lng: -3.5, distance: 1000 });

    expect(q.get("order_by")).toBe("newest");
    expect(q.get("distance_in_km")).toBe("1000");
  });

  it("SRC-16: an explicit ordering overrides the located default", () => {
    // The alert runner reads only page one, so a listing ranked twentieth by
    // relevance is one it never sees — and noticing new listings is the job.
    const q = buildWallapopQuery(
      { latitude: 41.38, longitude: 2.17, distanceInKm: 150 },
      { lat: 41.38, lng: 2.17, distance: 150, orderBy: "newest" },
    );

    expect(q.get("order_by")).toBe("newest");
  });

  it("SRC-16: without an override the located default still wins", () => {
    const q = buildWallapopQuery(
      { latitude: 41.38, longitude: 2.17, distanceInKm: 150 },
      { lat: 41.38, lng: 2.17, distance: 150 },
    );

    // Relevance is right for a human reading a list; only the poller differs.
    expect(q.get("order_by")).toBe("most_relevance");
  });

  it("orders by relevance and honours the given radius when located", () => {
    const q = buildWallapopQuery(
      { latitude: 41.38, longitude: 2.17, distanceInKm: 150 },
      { lat: 41.38, lng: 2.17, distance: 150 },
    );

    expect(q.get("order_by")).toBe("most_relevance");
    expect(q.get("latitude")).toBe("41.38");
    expect(q.get("longitude")).toBe("2.17");
    expect(q.get("distance_in_km")).toBe("150");
  });

  it("SRC-5: maps every provided filter to its Wallapop param name", () => {
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
    const q = buildWallapopQuery(input, { lat: 40, lng: -3.5 });

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

  it("forwards the next_page cursor for pagination", () => {
    const q = buildWallapopQuery({}, { lat: 40, lng: -3.5, nextPage: "cursor-xyz" });
    expect(q.get("next_page")).toBe("cursor-xyz");
  });
});
