import { describe, expect, it } from "vitest";
import type { SearchInput } from "@/lib/search/schema";
import { EN_COPY, ES_COPY } from "@/test/utils/copy";
import { createTranslator } from "next-intl";
import esMessages from "@/messages/es.json";
import { alertCriteria, alertName, alertSummary, alertZone } from "./alert-summary";

// docs/specs/redesign-map.md (MAPUI-40, worked examples under "Alert name
// and summary"). One pair of tests per row of the table. Every price comes
// from `formatPrice` (MAPUI-57), whose space before "€" is U+00A0; the
// place's "· 50 km" comes from the message, with a plain space.

describe("MAPUI-40: alertName and alertSummary — Toyota Corolla, max 20.000, Madrid 50 km", () => {
  const input: SearchInput = {
    brand: "Toyota",
    model: "Corolla",
    maxPrice: 20000,
    distanceInKm: 50,
  };

  it("MAPUI-40: name is Toyota Corolla · Madrid", () => {
    expect(alertName(input, "Madrid", ES_COPY)).toBe("Toyota Corolla · Madrid");
  });

  it("MAPUI-40: summary is Toyota Corolla · Hasta 20.000 € · Madrid · 50 km", () => {
    expect(alertSummary(input, "Madrid", ES_COPY)).toBe(
      "Toyota Corolla · Hasta 20.000 € · Madrid · 50 km",
    );
  });
});

describe("MAPUI-40: alertName and alertSummary — Toyota, Diésel, Automático, no place", () => {
  const input: SearchInput = { brand: "Toyota", engine: ["gasoil"], gearbox: ["automatic"] };

  it("MAPUI-40: name is just Toyota", () => {
    expect(alertName(input, undefined, ES_COPY)).toBe("Toyota");
  });

  it("MAPUI-40: summary is Toyota · Cualquier precio · Diésel · Automático", () => {
    expect(alertSummary(input, undefined, ES_COPY)).toBe(
      "Toyota · Cualquier precio · Diésel · Automático",
    );
  });
});

describe("MAPUI-40: alertName and alertSummary — max 20.000, Madrid 25 km, Últimas 24 h", () => {
  const input: SearchInput = { maxPrice: 20000, distanceInKm: 25, timeFilter: "today" };

  it("MAPUI-40: name is just Madrid (no brand set)", () => {
    expect(alertName(input, "Madrid", ES_COPY)).toBe("Madrid");
  });

  it("MAPUI-40: summary is Cualquier marca · Hasta 20.000 € · Madrid · 25 km, never mentioning Publicado", () => {
    const summary = alertSummary(input, "Madrid", ES_COPY);
    expect(summary).toBe("Cualquier marca · Hasta 20.000 € · Madrid · 25 km");
    expect(summary).not.toMatch(/24\sh/);
  });
});

describe("MAPUI-40: alertName and alertSummary — max 15.000 only", () => {
  const input: SearchInput = { maxPrice: 15000 };

  it("MAPUI-40: name is Hasta 15.000 € (no brand, no place to name it from)", () => {
    expect(alertName(input, undefined, ES_COPY)).toBe("Hasta 15.000 €");
  });

  it("MAPUI-40: summary is Cualquier marca · Hasta 15.000 €", () => {
    expect(alertSummary(input, undefined, ES_COPY)).toBe("Cualquier marca · Hasta 15.000 €");
  });
});

describe("MAPUI-40: alertName and alertSummary — nothing chosen (too broad, MAPUI-41)", () => {
  const input: SearchInput = {};

  it("MAPUI-40: name is empty", () => {
    expect(alertName(input, undefined, ES_COPY)).toBe("");
  });

  it("MAPUI-40: summary is Cualquier marca · Cualquier precio", () => {
    expect(alertSummary(input, undefined, ES_COPY)).toBe("Cualquier marca · Cualquier precio");
  });
});

describe("MAPUI-40: alertSummary — price phrasing", () => {
  it("MAPUI-40: a minimum with no maximum reads Desde X €", () => {
    expect(alertSummary({ minPrice: 3000 }, undefined, ES_COPY)).toBe(
      "Cualquier marca · Desde 3.000 €",
    );
  });

  it("MAPUI-40: a minimum and a maximum together read as a range", () => {
    expect(alertSummary({ minPrice: 3000, maxPrice: 20000 }, undefined, ES_COPY)).toBe(
      "Cualquier marca · 3.000 – 20.000 €",
    );
  });
});

describe("MAPUI-40: alertSummary — in the buyer's locale", () => {
  it("MAPUI-40: English copy writes the summary in English", () => {
    expect(alertSummary({ maxPrice: 15000 }, undefined, EN_COPY)).toBe("Any make · Up to €15,000");
  });
});

// docs/specs/redesign-alerts.md (ALERTUI-5; worked example "Criteria"): the
// AlertCard's criteria, a second function of this module beside the dialog's
// summary (Decisions › Two orders, one module). Every price comes from
// `formatPrice`, whose space before «€» is U+00A0; the mileage's space before
// «km» is U+00A0 too (`formatMileage`), and so is the zone's («{place} ·
// {km} km», «{km} km» in the messages).
const NBSP = "\u00a0";

describe("ALERTUI-5: alertCriteria — the rows of worked example «Criteria»", () => {
  it("ALERTUI-5: Corolla híbrido, with «Madrid», reads Toyota Corolla, Híbrido, Hasta 18.000 €, Madrid · 50 km", () => {
    const input: SearchInput = {
      brand: "Toyota",
      model: "Corolla",
      engine: ["hybride", "hybride_plugin"],
      maxPrice: 18000,
      latitude: 40.4168,
      longitude: -3.7038,
      distanceInKm: 50,
    };

    expect(alertCriteria(input, "Madrid", ES_COPY)).toEqual([
      "Toyota Corolla",
      "Híbrido",
      `Hasta 18.000${NBSP}€`,
      `Madrid · 50${NBSP}km`,
    ]);
  });

  it("ALERTUI-5: Golf TDI, with «Valencia», reads Volkswagen Golf, Diésel, Hasta 120.000 km, Valencia · 25 km", () => {
    const input: SearchInput = {
      brand: "Volkswagen",
      model: "Golf",
      engine: ["gasoil"],
      maxKm: 120000,
      latitude: 39.4699,
      longitude: -0.3763,
      distanceInKm: 25,
    };

    expect(alertCriteria(input, "Valencia", ES_COPY)).toEqual([
      "Volkswagen Golf",
      "Diésel",
      `Hasta 120.000${NBSP}km`,
      `Valencia · 25${NBSP}km`,
    ]);
  });

  it("ALERTUI-5: Clio barato, created before F6 with no place name, reads the radius alone — Renault Clio, Hasta 9.000 €, 50 km", () => {
    const input: SearchInput = {
      brand: "Renault",
      model: "Clio",
      maxPrice: 9000,
      latitude: 40.4168,
      longitude: -3.7038,
      distanceInKm: 50,
    };

    expect(alertCriteria(input, null, ES_COPY)).toEqual([
      "Renault Clio",
      `Hasta 9.000${NBSP}€`,
      `50${NBSP}km`,
    ]);
  });

  it("ALERTUI-5: Serie 3 diésel, with no point, has no zone — BMW Serie 3, Diésel, Hasta 20.000 €", () => {
    const input: SearchInput = {
      brand: "BMW",
      model: "Serie 3",
      engine: ["gasoil"],
      maxPrice: 20000,
    };

    expect(alertCriteria(input, null, ES_COPY)).toEqual([
      "BMW Serie 3",
      "Diésel",
      `Hasta 20.000${NBSP}€`,
    ]);
  });
});

describe("ALERTUI-5: alertCriteria — the orders the boards do not draw", () => {
  it("ALERTUI-5: every criterion set reads car, fuel, price, gearbox, mileage, year, zone", () => {
    const input: SearchInput = {
      brand: "Toyota",
      engine: ["gasoline"],
      minPrice: 3000,
      maxPrice: 20000,
      gearbox: ["automatic"],
      maxKm: 100000,
      minYear: 2017,
      latitude: 40.4168,
      longitude: -3.7038,
      distanceInKm: 50,
    };

    expect(alertCriteria(input, "Madrid", ES_COPY)).toEqual([
      "Toyota",
      "Gasolina",
      `3.000 – 20.000${NBSP}€`,
      "Automático",
      `Hasta 100.000${NBSP}km`,
      "Desde 2017",
      `Madrid · 50${NBSP}km`,
    ]);
  });

  it("ALERTUI-5: a price and a zone alone read Hasta 15.000 €, Madrid · 25 km — no «Cualquier marca»", () => {
    const input: SearchInput = {
      maxPrice: 15000,
      latitude: 40.4168,
      longitude: -3.7038,
      distanceInKm: 25,
    };

    const parts = alertCriteria(input, "Madrid", ES_COPY);

    expect(parts).toEqual([`Hasta 15.000${NBSP}€`, `Madrid · 25${NBSP}km`]);
    expect(parts).not.toContain("Cualquier marca");
  });

  it("ALERTUI-5: a brand alone reads Toyota — no «Cualquier precio»", () => {
    expect(alertCriteria({ brand: "Toyota" }, null, ES_COPY)).toEqual(["Toyota"]);
  });

  it("ALERTUI-5: a timeFilter and ?q= text stored before MAPUI-42 never show — Toyota only, no «Últimas 24 h»", () => {
    const input: SearchInput = { brand: "Toyota", timeFilter: "today", keywords: "golf" };

    expect(alertCriteria(input, null, ES_COPY)).toEqual(["Toyota"]);
  });

  it("ALERTUI-5: manual + automatic (an old link) give no gearbox part (MAPUI-16)", () => {
    const input: SearchInput = { brand: "Toyota", gearbox: ["manual", "automatic"] };

    expect(alertCriteria(input, null, ES_COPY)).toEqual(["Toyota"]);
  });

  it("ALERTUI-5: criteria that failed to parse (read as {}) give no part, even with a place name", () => {
    expect(alertCriteria({}, "Madrid", ES_COPY)).toEqual([]);
  });

  it("ALERTUI-5: a place name with no point gives no zone", () => {
    expect(alertCriteria({ brand: "BMW" }, "Madrid", ES_COPY)).toEqual(["BMW"]);
  });
});

describe("ALERTUI-5: alertZone — the zone alone, for the pills", () => {
  const point = { latitude: 40.4168, longitude: -3.7038, distanceInKm: 50 };

  it("ALERTUI-5: with a place name, Madrid · 50 km", () => {
    expect(alertZone({ brand: "Toyota", ...point }, "Madrid", ES_COPY)).toBe(
      `Madrid · 50${NBSP}km`,
    );
  });

  it("ALERTUI-5: with a place but no place name, 50 km", () => {
    expect(alertZone({ brand: "Renault", ...point }, null, ES_COPY)).toBe(`50${NBSP}km`);
  });

  it("ALERTUI-5: with no place, nothing", () => {
    expect(alertZone({ brand: "BMW", maxPrice: 20000 }, "Madrid", ES_COPY)).toBeUndefined();
  });
});

// docs/specs/redesign-alerts.md (ALERTUI-9; worked example "Count"): the
// match count is the message `alerts.matchCount`, read here through the real
// Spanish messages as next-intl formats them.
describe("ALERTUI-9: the match count", () => {
  const t = createTranslator({ locale: "es", messages: esMessages });

  it.each([
    [0, "Sin coincidencias"],
    [1, "1 coincidencia"],
    [4, "4 coincidencias"],
    [12, "12 coincidencias"],
  ])("ALERTUI-9: %i reads «%s»", (count, expected) => {
    expect(t("alerts.matchCount", { count })).toBe(expected);
  });
});
