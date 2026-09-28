import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { makeMilanunciosAd, makeMilanunciosResponse } from "@/test/fixtures/milanuncios";
import { searchMilanuncios } from "./client";

// Capture the query string the client sends to the proxy route.
function captureQuery(): () => URLSearchParams {
  let captured = new URLSearchParams();
  server.use(
    http.get("*/api/milanuncios/search", ({ request }) => {
      captured = new URL(request.url).searchParams;
      return HttpResponse.json(makeMilanunciosResponse([]));
    }),
  );
  return () => captured;
}

describe("searchMilanuncios", () => {
  it("defaults to the all-cars slug and omits pagina on page 1", async () => {
    const query = captureQuery();
    await searchMilanuncios({}, 1);

    expect(query().get("slug")).toBe("coches-de-segunda-mano");
    expect(query().has("pagina")).toBe(false);
  });

  it("scopes to the brand slug and sends the page number past page 1", async () => {
    const query = captureQuery();
    await searchMilanuncios({ brand: "Audi" }, 3);

    expect(query().get("slug")).toBe("audi-de-segunda-mano");
    expect(query().get("pagina")).toBe("3");
  });

  it("translates ranges into Milanuncios param names", async () => {
    const query = captureQuery();
    await searchMilanuncios({
      minPrice: 5000,
      maxPrice: 15000,
      minYear: 2018,
      maxKm: 120000,
      minHorsePower: 90,
    });
    const q = query();

    expect(q.get("desde")).toBe("5000");
    expect(q.get("hasta")).toBe("15000");
    expect(q.get("anod")).toBe("2018");
    expect(q.get("anoh")).toBeNull();
    expect(q.get("kilometersTo")).toBe("120000");
    expect(q.get("engineHpFrom")).toBe("90");
  });

  it("SRC-5: maps fuel and transmission tokens and folds the model into palabras", async () => {
    const query = captureQuery();
    await searchMilanuncios({
      keywords: "familiar",
      model: "A4",
      engine: ["gasoil"],
      gearbox: ["automatic"],
    });
    const q = query();

    expect(q.get("palabras")).toBe("familiar A4");
    expect(q.get("fuels")).toBe("diesel");
    expect(q.get("cajacambio")).toBe("automatico");
  });

  it("resolves and returns the proxy JSON", async () => {
    server.use(
      http.get("*/api/milanuncios/search", () =>
        HttpResponse.json(makeMilanunciosResponse([makeMilanunciosAd({ id: "42" })], 2)),
      ),
    );

    const result = await searchMilanuncios({});
    expect(result.ads[0].id).toBe("42");
    expect(result.pagination.totalPages).toBe(2);
  });

  it("SRC-13: throws when the proxy responds with a non-ok status", async () => {
    server.use(
      http.get("*/api/milanuncios/search", () =>
        HttpResponse.json({ error: "boom" }, { status: 502 }),
      ),
    );
    await expect(searchMilanuncios({})).rejects.toThrow(/Milanuncios API error: 502/);
  });
});
