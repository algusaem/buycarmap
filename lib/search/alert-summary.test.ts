import { describe, expect, it } from "vitest";
import type { SearchInput } from "@/lib/search/schema";
import { EN_COPY, ES_COPY } from "@/test/utils/copy";
import { alertName, alertSummary } from "./alert-summary";

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
