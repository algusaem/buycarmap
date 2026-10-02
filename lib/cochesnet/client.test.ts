import { describe, expect, it } from "vitest";
import { buildCochesNetFilters } from "./client";

// FRONT-5 (docs/specs/core-frontend.md): `searchCochesNet`, the browser-bound
// fetcher that called the (deleted) `/api/cochesnet/search` proxy and
// resolved a model name through the (deleted) `/api/cochesnet/models` proxy,
// is gone. `buildCochesNetFilters` is the pure, reusable part —
// server/search/service.ts is its only caller now, and it resolves the model
// id itself (server/search/service.node.test.ts) — and stays fully covered
// here without any network.

describe("buildCochesNetFilters", () => {
  it("translates ranges, keeping the open end null", () => {
    const filters = buildCochesNetFilters({
      keywords: "familiar",
      minPrice: 8000,
      maxYear: 2020,
    });

    expect(filters.searchText).toBe("familiar");
    expect(filters.price).toEqual({ from: 8000, to: null });
    expect(filters.year).toEqual({ from: null, to: 2020 });
    expect(filters.km).toBeUndefined();
  });

  it("maps fuel and transmission tokens to coches.net ids", () => {
    const filters = buildCochesNetFilters({ engine: ["gasoil"], gearbox: ["automatic"] });

    expect(filters.fuelTypeIds).toEqual([1]);
    expect(filters.transmissionTypeId).toBe(1);
  });

  it("maps a brand to its makeId, with no model refinement", () => {
    // Audi → makeId 4. Model-name resolution happens server-side now
    // (server/search/service.ts's resolveCochesNetModelId).
    const filters = buildCochesNetFilters({ brand: "Audi", model: "A3" });

    expect(filters.vehicles).toEqual([{ makeId: 4 }]);
  });

  it("omits the vehicle filter for a brand with no coches.net mapping", () => {
    const filters = buildCochesNetFilters({ brand: "Not A Real Brand" });

    expect(filters.vehicles).toBeUndefined();
  });
});
