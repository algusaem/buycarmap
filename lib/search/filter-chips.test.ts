import { describe, expect, it } from "vitest";
import type { SearchInput } from "@/lib/search/schema";
import { EN_COPY, ES_COPY } from "@/test/utils/copy";
import { carLabel, filterChips, placeLabel, priceLabel } from "./filter-chips";

// docs/specs/redesign-map.md (MAPUI-13, worked examples under "Chip texts").
// `filterChips` is `SearchInput` in, chip list out — the filters row's badge
// count is this array's length, read by the components (FilterRow,
// PhoneSearchBar, through lib/hooks/useFilterCount.ts), not by this module.
// Prices come from `formatPrice` and mileages from `formatMileage`, whose
// space before "€" and "km" is U+00A0 (MAPUI-57, FRONT-11).

describe("MAPUI-13: filterChips — fuel", () => {
  it("MAPUI-13: engine=gasoil gives one chip, Diésel", () => {
    expect(filterChips({ engine: ["gasoil"] }, ES_COPY)).toEqual([
      { key: "engine:gasoil", label: "Diésel" },
    ]);
  });

  it("MAPUI-13: engine=gasoline,gasoil gives two chips, Gasolina and Diésel", () => {
    const chips = filterChips({ engine: ["gasoline", "gasoil"] }, ES_COPY);
    expect(chips.map((chip) => chip.label)).toEqual(["Gasolina", "Diésel"]);
  });

  it("MAPUI-13: engine=hybride,hybride_plugin gives one chip, Híbrido", () => {
    expect(filterChips({ engine: ["hybride", "hybride_plugin"] }, ES_COPY)).toEqual([
      { key: "engine:hybrid", label: "Híbrido" },
    ]);
  });
});

describe("MAPUI-13: filterChips — gearbox", () => {
  it("MAPUI-13: gearbox=automatic gives the chip Automático", () => {
    expect(filterChips({ gearbox: ["automatic"] }, ES_COPY)).toEqual([
      { key: "gearbox", label: "Automático" },
    ]);
  });

  it("MAPUI-13: gearbox=manual,automatic gives no chip, since it reads as «Todos» (MAPUI-16)", () => {
    expect(filterChips({ gearbox: ["manual", "automatic"] }, ES_COPY)).toEqual([]);
  });

  it("MAPUI-13: gearbox=semiautomatic gives no chip, since the UI no longer offers it (MAPUI-18)", () => {
    expect(filterChips({ gearbox: ["semiautomatic"] }, ES_COPY)).toEqual([]);
  });
});

describe("MAPUI-13: filterChips — price, mileage, year, recency", () => {
  it("MAPUI-13: maxPrice=20000 gives the chip Hasta 20.000 €", () => {
    expect(filterChips({ maxPrice: 20000 }, ES_COPY)).toEqual([
      { key: "maxPrice", label: "Hasta 20.000 €" },
    ]);
  });

  it("MAPUI-13: maxKm=100000 gives the chip Hasta 100.000 km", () => {
    expect(filterChips({ maxKm: 100000 }, ES_COPY)).toEqual([
      { key: "maxKm", label: "Hasta 100.000 km" },
    ]);
  });

  it("MAPUI-13: minYear=2017 gives the chip Desde 2017", () => {
    expect(filterChips({ minYear: 2017 }, ES_COPY)).toEqual([
      { key: "minYear", label: "Desde 2017" },
    ]);
  });

  it("MAPUI-13: timeFilter=today gives the chip Últimas 24 h", () => {
    expect(filterChips({ timeFilter: "today" }, ES_COPY)).toEqual([
      { key: "timeFilter", label: "Últimas 24 h" },
    ]);
  });
});

describe("MAPUI-13: filterChips — brand and model", () => {
  it("MAPUI-13: make=Toyota&model=Corolla gives one chip, Toyota Corolla", () => {
    expect(filterChips({ brand: "Toyota", model: "Corolla" }, ES_COPY)).toEqual([
      { key: "brand", label: "Toyota Corolla" },
    ]);
  });
});

describe("MAPUI-13: filterChips — the combined worked example", () => {
  it("MAPUI-13: engine=gasoil&maxPrice=20000&gearbox=automatic&timeFilter=today gives 4 chips in order", () => {
    const input: SearchInput = {
      engine: ["gasoil"],
      maxPrice: 20000,
      gearbox: ["automatic"],
      timeFilter: "today",
    };

    const chips = filterChips(input, ES_COPY);

    expect(chips.map((chip) => chip.label)).toEqual([
      "Diésel",
      "Hasta 20.000 €",
      "Automático",
      "Últimas 24 h",
    ]);
    // The badge shown next to "Filtros" is this array's length.
    expect(chips).toHaveLength(4);
  });
});

describe("MAPUI-13: filterChips — nothing active", () => {
  it("MAPUI-13: no criteria give no chips, so the badge is not shown", () => {
    expect(filterChips({}, ES_COPY)).toEqual([]);
  });

  it("MAPUI-13: criteria the UI no longer offers give no chips (MAPUI-18; minKm left this list, MAPUI-84)", () => {
    expect(
      filterChips(
        {
          maxYear: 2015,
          minHorsePower: 90,
          maxHorsePower: 200,
          engine: ["cng"],
        },
        ES_COPY,
      ),
    ).toEqual([]);
  });
});

// docs/specs/map-description-search.md (DESC-17): the text does not count
// in the «Filtros» badge (this array's length, lib/hooks/useFilterCount.ts)
// and does not appear in the Coche value (carLabel).
describe("DESC-17: filterChips and carLabel ignore the description text", () => {
  it("DESC-17: keywords alone gives no chip, so the badge stays at 0", () => {
    expect(filterChips({ keywords: "e46" }, ES_COPY)).toEqual([]);
  });

  it("DESC-17: a brand with keywords still gives only the brand's chip", () => {
    expect(filterChips({ brand: "BMW", keywords: "e46" }, ES_COPY)).toEqual([
      { key: "brand", label: "BMW" },
    ]);
  });

  it("DESC-17: carLabel never mentions the text", () => {
    const input: SearchInput = { brand: "BMW", keywords: "e46" };
    expect(carLabel(input, ES_COPY)).toBe("BMW");
  });
});

// docs/specs/redesign-map.md (MAPUI-75, worked example "Chip texts"): minKm is
// an active criterion again — the panel offers «Mínimo» (MAPUI-84) — so it now
// gives a chip, alone «Desde 50.000 km», and combined with maxKm exactly ONE
// range chip rather than two separate ones. formatMileage's space before "km"
// is U+00A0 (FRONT-11, MAPUI-57).
describe("MAPUI-75: filterChips — minimum mileage, alone and combined with the maximum", () => {
  it("MAPUI-75: minKm=50000 alone gives one chip, Desde 50.000 km", () => {
    const chips = filterChips({ minKm: 50000 }, ES_COPY);

    expect(chips.map((chip) => chip.label)).toEqual(["Desde 50.000 km"]);
  });

  it("MAPUI-75: minKm=50000&maxKm=100000 gives exactly one km chip, the range 50.000 – 100.000 km", () => {
    const chips = filterChips({ minKm: 50000, maxKm: 100000 }, ES_COPY);

    expect(chips.map((chip) => chip.label)).toEqual(["50.000 – 100.000 km"]);
  });

  it("MAPUI-75: maxKm=100000 alone still reads Hasta 100.000 km, unchanged by the minimum's addition", () => {
    expect(filterChips({ maxKm: 100000 }, ES_COPY).map((chip) => chip.label)).toEqual([
      "Hasta 100.000 km",
    ]);
  });

  it("MAPUI-75: English copy — minKm and maxKm together read the range, minKm alone reads From", () => {
    expect(filterChips({ minKm: 50000, maxKm: 100000 }, EN_COPY).map((chip) => chip.label)).toEqual(
      ["50,000 – 100,000 km"],
    );
    expect(filterChips({ minKm: 50000 }, EN_COPY).map((chip) => chip.label)).toEqual([
      "From 50,000 km",
    ]);
  });

  it("MAPUI-75: equal ends read as that one mileage, 100.000 km", () => {
    expect(
      filterChips({ minKm: 100000, maxKm: 100000 }, ES_COPY).map((chip) => chip.label),
    ).toEqual(["100.000 km"]);
  });

  it("MAPUI-75: a four-digit range reads 5.000 – 9.000 km, grouped on both ends", () => {
    expect(filterChips({ minKm: 5000, maxKm: 9000 }, ES_COPY).map((chip) => chip.label)).toEqual([
      "5.000 – 9.000 km",
    ]);
  });

  it("MAPUI-75: a minimum above the maximum (an old link's or a saved alert's reversed ends) reads in the order they came, 150.000 – 100.000 km", () => {
    expect(
      filterChips({ minKm: 150000, maxKm: 100000 }, ES_COPY).map((chip) => chip.label),
    ).toEqual(["150.000 – 100.000 km"]);
  });
});

describe("MAPUI-13: filterChips — in the buyer's locale", () => {
  it("MAPUI-13: English copy writes the chips in English", () => {
    expect(filterChips({ maxPrice: 20000, maxKm: 100000 }, EN_COPY)).toEqual([
      { key: "maxPrice", label: "Up to €20,000" },
      { key: "maxKm", label: "Up to 100,000 km" },
    ]);
  });
});

// docs/specs/redesign-map.md (MAPUI-1, worked example "Pill segment values";
// MAPUI-20, the phone summary's «hasta 20.000 €»).
describe("MAPUI-1: priceLabel", () => {
  it("MAPUI-1: max 20.000 reads Hasta 20.000 €", () => {
    expect(priceLabel({ maxPrice: 20000 }, ES_COPY)).toBe("Hasta 20.000 €");
  });

  it("MAPUI-1: min 3.000 reads Desde 3.000 €", () => {
    expect(priceLabel({ minPrice: 3000 }, ES_COPY)).toBe("Desde 3.000 €");
  });

  it("MAPUI-1: min 3.000 and max 20.000 read 3.000 – 20.000 €", () => {
    expect(priceLabel({ minPrice: 3000, maxPrice: 20000 }, ES_COPY)).toBe("3.000 – 20.000 €");
  });

  it("MAPUI-1: no price reads nothing, so the caller shows its own «Cualquiera»", () => {
    expect(priceLabel({}, ES_COPY)).toBeUndefined();
  });

  it("MAPUI-20: the summary wording writes hasta 20.000 € and desde 3.000 € in lower case", () => {
    expect(priceLabel({ maxPrice: 20000 }, ES_COPY, "summary")).toBe("hasta 20.000 €");
    expect(priceLabel({ minPrice: 3000 }, ES_COPY, "summary")).toBe("desde 3.000 €");
  });
});

describe("MAPUI-1: placeLabel", () => {
  it("MAPUI-1: Madrid at 50 km reads Madrid · 50 km", () => {
    expect(placeLabel("Madrid", 50, ES_COPY)).toBe("Madrid · 50 km");
  });

  it("MAPUI-40: a place with no radius reads the place alone", () => {
    expect(placeLabel("Madrid", undefined, ES_COPY)).toBe("Madrid");
  });

  it("MAPUI-1: no place reads nothing, so the caller shows its own placeholder or «Toda España»", () => {
    expect(placeLabel(undefined, 50, ES_COPY)).toBeUndefined();
  });
});
