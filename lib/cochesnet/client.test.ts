import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { makeCochesNetResponse, makeCochesNetTaxonomy } from "@/test/fixtures/cochesnet";
import { searchCochesNet } from "./client";

interface CochesNetPayload {
  pagination: { page: number; size: number };
  sort: { order: string; term: string };
  filters: {
    searchText?: string;
    price?: { from: number | null; to: number | null };
    year?: { from: number | null; to: number | null };
    km?: { from: number | null; to: number | null };
    hp?: { from: number | null; to: number | null };
    fuelTypeIds?: number[];
    transmissionTypeId?: number;
    vehicles?: { makeId: number; modelId?: number }[];
  };
}

// Capture the JSON body the client POSTs to the proxy route.
function capturePayload(): () => CochesNetPayload {
  let captured = {} as CochesNetPayload;
  server.use(
    http.post("*/api/cochesnet/search", async ({ request }) => {
      captured = (await request.json()) as CochesNetPayload;
      return HttpResponse.json(makeCochesNetResponse([]));
    }),
  );
  return () => captured;
}

describe("searchCochesNet", () => {
  it("sends pagination and sort defaults", async () => {
    const payload = capturePayload();
    await searchCochesNet({}, 2);
    const body = payload();

    expect(body.pagination).toEqual({ page: 2, size: 40 });
    expect(body.sort).toEqual({ order: "desc", term: "relevance" });
  });

  it("translates ranges, keeping the open end null", async () => {
    const payload = capturePayload();
    await searchCochesNet({
      keywords: "familiar",
      minPrice: 8000,
      maxYear: 2020,
    });
    const { filters } = payload();

    expect(filters.searchText).toBe("familiar");
    expect(filters.price).toEqual({ from: 8000, to: null });
    expect(filters.year).toEqual({ from: null, to: 2020 });
    expect(filters.km).toBeUndefined();
  });

  it("maps fuel and transmission tokens to coches.net ids", async () => {
    const payload = capturePayload();
    await searchCochesNet({ engine: ["gasoil"], gearbox: ["automatic"] });
    const { filters } = payload();

    expect(filters.fuelTypeIds).toEqual([1]);
    expect(filters.transmissionTypeId).toBe(1);
  });

  it("resolves brand + model to makeId + modelId", async () => {
    // Audi → makeId 4; model list returns A3 → id 5501.
    server.use(
      http.get("*/api/cochesnet/models", () =>
        HttpResponse.json(makeCochesNetTaxonomy([{ id: 5501, label: "A3" }])),
      ),
    );
    const payload = capturePayload();
    await searchCochesNet({ brand: "Audi", model: "A3" });

    expect(payload().filters.vehicles).toEqual([{ makeId: 4, modelId: 5501 }]);
  });

  it("SRC-7: filters by make only when the model name has no exact match", async () => {
    // Seat → makeId 39; model list lacks the requested name.
    server.use(
      http.get("*/api/cochesnet/models", () =>
        HttpResponse.json(makeCochesNetTaxonomy([{ id: 1, label: "Leon" }])),
      ),
    );
    const payload = capturePayload();
    await searchCochesNet({ brand: "Seat", model: "Nonexistent" });

    expect(payload().filters.vehicles).toEqual([{ makeId: 39 }]);
  });

  it("SRC-13: throws when the proxy responds with a non-ok status", async () => {
    server.use(
      http.post("*/api/cochesnet/search", () =>
        HttpResponse.json({ error: "boom" }, { status: 502 }),
      ),
    );
    await expect(searchCochesNet({})).rejects.toThrow(/Coches\.net API error: 502/);
  });
});
