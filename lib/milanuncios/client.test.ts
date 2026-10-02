import { describe, expect, it } from "vitest";
import { buildMilanunciosQuery } from "./client";

// FRONT-5 (docs/specs/core-frontend.md): `searchMilanuncios`, the
// browser-bound fetcher that called the (deleted) `/api/milanuncios/search`
// proxy, is gone. `buildMilanunciosQuery` is the pure, reusable part —
// server/search/service.ts is its only caller now — and stays fully covered
// here without any network.

describe("buildMilanunciosQuery", () => {
  it("defaults to the all-cars slug and omits pagina on page 1", () => {
    const query = buildMilanunciosQuery({}, 1);

    expect(query.get("slug")).toBe("coches-de-segunda-mano");
    expect(query.has("pagina")).toBe(false);
  });

  it("scopes to the brand slug and sends the page number past page 1", () => {
    const query = buildMilanunciosQuery({ brand: "Audi" }, 3);

    expect(query.get("slug")).toBe("audi-de-segunda-mano");
    expect(query.get("pagina")).toBe("3");
  });

  it("translates ranges into Milanuncios param names", () => {
    const query = buildMilanunciosQuery(
      {
        minPrice: 5000,
        maxPrice: 15000,
        minYear: 2018,
        maxKm: 120000,
        minHorsePower: 90,
      },
      1,
    );

    expect(query.get("desde")).toBe("5000");
    expect(query.get("hasta")).toBe("15000");
    expect(query.get("anod")).toBe("2018");
    expect(query.get("anoh")).toBeNull();
    expect(query.get("kilometersTo")).toBe("120000");
    expect(query.get("engineHpFrom")).toBe("90");
  });

  it("SRC-5: maps fuel and transmission tokens and folds the model into palabras", () => {
    const query = buildMilanunciosQuery(
      {
        keywords: "familiar",
        model: "A4",
        engine: ["gasoil"],
        gearbox: ["automatic"],
      },
      1,
    );

    expect(query.get("palabras")).toBe("familiar A4");
    expect(query.get("fuels")).toBe("diesel");
    expect(query.get("cajacambio")).toBe("automatico");
  });
});
