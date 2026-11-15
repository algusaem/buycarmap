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

// docs/specs/redesign-map.md (MAPUI-75): minKm is an active criterion again,
// so the summary and the criteria both carry it — alone as «Desde 50.000 km»,
// combined with maxKm as the one range «50.000 – 100.000 km» (never two
// separate mileage parts). formatMileage's space before "km" is U+00A0.
describe("MAPUI-75: alertSummary and alertCriteria — minimum mileage", () => {
  it("MAPUI-75: alertSummary with a brand, minKm and maxKm contains the range 50.000 – 100.000 km", () => {
    const input: SearchInput = { brand: "Toyota", minKm: 50000, maxKm: 100000 };

    expect(alertSummary(input, undefined, ES_COPY)).toBe(
      "Toyota · Cualquier precio · 50.000 – 100.000 km",
    );
  });

  it("MAPUI-75: alertCriteria with a brand, minKm and maxKm contains the range 50.000 – 100.000 km", () => {
    const input: SearchInput = { brand: "Toyota", minKm: 50000, maxKm: 100000 };

    expect(alertCriteria(input, null, ES_COPY)).toEqual(["Toyota", "50.000 – 100.000 km"]);
  });

  it("MAPUI-86: minKm above maxKm still reads as the range in the given order, 150.000 – 100.000 km", () => {
    const input: SearchInput = { brand: "Toyota", minKm: 150000, maxKm: 100000 };

    expect(alertSummary(input, undefined, ES_COPY)).toBe(
      `Toyota · Cualquier precio · 150.000 – 100.000 km`,
    );
  });

  it("MAPUI-75: a brand with minKm alone reads Toyota · Cualquier precio · Desde 50.000 km", () => {
    const input: SearchInput = { brand: "Toyota", minKm: 50000 };

    expect(alertSummary(input, undefined, ES_COPY)).toBe(
      `Toyota · Cualquier precio · Desde 50.000 km`,
    );
    expect(alertCriteria(input, null, ES_COPY)).toEqual(["Toyota", `Desde 50.000 km`]);
  });

  it("MAPUI-75: English copy — alertCriteria with a brand and minKm reads From 50,000 km", () => {
    const input: SearchInput = { brand: "Toyota", minKm: 50000 };

    expect(alertCriteria(input, null, EN_COPY)).toEqual(["Toyota", `From 50,000 km`]);
  });
});

describe("MAPUI-40: alertSummary — in the buyer's locale", () => {
  it("MAPUI-40: English copy writes the summary in English", () => {
    expect(alertSummary({ maxPrice: 15000 }, undefined, EN_COPY)).toBe("Any make · Up to €15,000");
  });
});

// docs/specs/map-and-search.md (MAP-36): «Crear alerta» from a search centred
// on the browser's position stores no place name, so the summary ends with
// the radius alone, as the saved alert's card reads it (ALERTUI-5). Expected
// values from messages/es.json: «search.anyPrice» is «Cualquier precio» and
// «search.radiusOption» is «{km} km», with U+00A0 before «km».
describe("MAP-36: alertSummary — a search around the browser's position", () => {
  const input: SearchInput = {
    brand: "Toyota",
    model: "Corolla",
    latitude: 40.42,
    longitude: -3.7,
    distanceInKm: 50,
  };

  it("MAP-36: with no place name, the summary ends with the radius alone", () => {
    expect(alertSummary(input, undefined, ES_COPY)).toBe(
      "Toyota Corolla · Cualquier precio · 50 km",
    );
  });

  it("MAP-36: the prefilled name is the car alone", () => {
    expect(alertName(input, undefined, ES_COPY)).toBe("Toyota Corolla");
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

  it("DESC-30: timeFilter still never shows, but the saved text now does, right after the car — Toyota, «golf»", () => {
    const input: SearchInput = { brand: "Toyota", timeFilter: "today", keywords: "golf" };

    expect(alertCriteria(input, null, ES_COPY)).toEqual(["Toyota", "«golf»"]);
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

// docs/specs/map-description-search.md (DESC-21; worked example under
// "Alerts"): alertName and alertSummary carry the saved text too, reversing
// MAPUI-42.
describe("DESC-21: alertName and alertSummary carry the description text", () => {
  const withBrand: SearchInput = {
    brand: "BMW",
    maxPrice: 20000,
    distanceInKm: 50,
    keywords: "e46",
  };

  it("DESC-21: name is «BMW e46 · Madrid»", () => {
    expect(alertName(withBrand, "Madrid", ES_COPY)).toBe("BMW e46 · Madrid");
  });

  it("DESC-21: summary is «BMW · «e46» · Hasta 20.000 € · Madrid · 50 km»", () => {
    expect(alertSummary(withBrand, "Madrid", ES_COPY)).toBe(
      "BMW · «e46» · Hasta 20.000 € · Madrid · 50 km",
    );
  });

  const noBrand: SearchInput = { maxPrice: 20000, distanceInKm: 50, keywords: "e46" };

  it("DESC-21: with no brand, the name starts with the text — «e46 · Madrid»", () => {
    expect(alertName(noBrand, "Madrid", ES_COPY)).toBe("e46 · Madrid");
  });

  it("DESC-21: with no brand, the summary starts with «Cualquier marca · «e46»»", () => {
    expect(alertSummary(noBrand, "Madrid", ES_COPY)).toBe(
      "Cualquier marca · «e46» · Hasta 20.000 € · Madrid · 50 km",
    );
  });
});

// docs/specs/map-description-search.md (DESC-30; worked example "Criteria"):
// alertCriteria lists the saved text as its own item, right after the car —
// first when there is no car.
describe("DESC-30: alertCriteria lists the saved description text", () => {
  it("DESC-30: BMW, Madrid 50 km, max 20.000 €, text e46 lists [BMW, «e46», Hasta 20.000 €, Madrid · 50 km]", () => {
    const input: SearchInput = {
      brand: "BMW",
      maxPrice: 20000,
      latitude: 40.4168,
      longitude: -3.7038,
      distanceInKm: 50,
      keywords: "e46",
    };

    expect(alertCriteria(input, "Madrid", ES_COPY)).toEqual([
      "BMW",
      "«e46»",
      `Hasta 20.000${NBSP}€`,
      `Madrid · 50${NBSP}km`,
    ]);
  });

  it("DESC-30: with no brand, the text comes first", () => {
    expect(alertCriteria({ keywords: "e46" }, null, ES_COPY)).toEqual(["«e46»"]);
  });

  it("DESC-30: an alert with no text lists what it does today", () => {
    expect(alertCriteria({ brand: "Toyota" }, null, ES_COPY)).toEqual(["Toyota"]);
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
