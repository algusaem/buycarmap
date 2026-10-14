import { describe, expect, it } from "vitest";
import { formatAmount, formatMileage, formatPrice, parseDeviceLabel } from "./format";

// FRONT-11 (docs/specs/core-frontend.md) worked examples. Each expected
// string was independently derived by running the equivalent
// `Intl.NumberFormat` call in Node and inspecting its code points — not by
// calling `formatPrice`/`formatMileage` themselves, which are still stubs
// returning `""` (lib/format.ts) until date-fns lands (migration phase 9).
//
//   > new Intl.NumberFormat("es", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(12500)
//   "12.500 €"   — "." as the thousands separator, then U+00A0 (NBSP,
//                        not a plain space) before the currency symbol; the
//                        space's code point was confirmed with
//                        `[...s].map(c => c.codePointAt(0).toString(16))`,
//                        which printed "a0" between "500" and "20ac" (€).
//   > new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(12500)
//   "€12,500"         — symbol first, "," as the thousands separator, no space.
//   > new Intl.NumberFormat("es").format(84000)
//   "84.000"          — then " km" is appended with the same NBSP, per the
//                        spec's literal worked example.
describe("formatPrice", () => {
  it("FRONT-11: formats euros for the Spanish locale with a period thousands separator and NBSP before the symbol", () => {
    expect(formatPrice(12500, "es")).toBe("12.500 €");
  });

  it("FRONT-11: formats euros for the English locale with the symbol first and a comma thousands separator", () => {
    expect(formatPrice(12500, "en")).toBe("€12,500");
  });
});

// docs/specs/redesign-map.md (MAPUI-57, worked example "Price format"). Spanish
// `Intl` leaves four-digit amounts ungrouped ("9500 €"); every price takes the
// thousands point. The space before "€" is U+00A0, as in FRONT-11 above. A
// range is written as the pill draws it (MAPUI-1, «3.000 – 20.000 €»): the
// en dash with a space either side, the symbol where the locale puts it.
describe("formatPrice — one format for every price (MAPUI-57)", () => {
  it("MAPUI-57: 9500 in Spanish reads 9.500 €, four digits grouped too", () => {
    expect(formatPrice(9500, "es")).toBe("9.500 €");
  });

  it("MAPUI-57: 14500 in Spanish reads 14.500 €", () => {
    expect(formatPrice(14500, "es")).toBe("14.500 €");
  });

  it("MAPUI-57: English keeps its own grouping for four digits, €9,500", () => {
    expect(formatPrice(9500, "en")).toBe("€9,500");
  });

  it("MAPUI-57: a range from 3.000 to 20.000 reads 3.000 – 20.000 € in Spanish and €3,000 – €20,000 in English", () => {
    expect(formatPrice({ min: 3000, max: 20000 }, "es")).toBe("3.000 – 20.000 €");
    expect(formatPrice({ min: 3000, max: 20000 }, "en")).toBe("€3,000 – €20,000");
  });

  it("MAPUI-57: a range whose ends are equal reads as that one price", () => {
    expect(formatPrice({ min: 9500, max: 9500 }, "es")).toBe("9.500 €");
  });

  it("MAPUI-57: lib/format.ts has no second price formatter", async () => {
    const formatters = Object.keys(await import("./format")).sort();
    expect(formatters).toEqual([
      "formatAmount",
      "formatMileage",
      "formatPrice",
      "formatRelativeTime",
      "parseDeviceLabel",
    ]);
  });
});

// docs/specs/redesign-map.md (MAPUI-11): the amount boxes' own formatter,
// built from the same options formatPrice uses, minus the currency.
describe("formatAmount", () => {
  it("MAPUI-11: 20000 in Spanish reads 20.000, with the thousands point", () => {
    expect(formatAmount(20000, "es")).toBe("20.000");
  });

  it("MAPUI-11: 100000 in Spanish reads 100.000", () => {
    expect(formatAmount(100000, "es")).toBe("100.000");
  });

  it("MAPUI-11: 100000 in English reads 100,000, with a comma", () => {
    expect(formatAmount(100000, "en")).toBe("100,000");
  });
});

// BAUTH-4 (docs/specs/core-better-auth.md): the "Active sessions" list on
// /account reads both fields off a real `User-Agent` string.
describe("parseDeviceLabel", () => {
  it("BAUTH-4: reads Chrome on Windows", () => {
    expect(
      parseDeviceLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      ),
    ).toEqual({ browser: "Chrome", os: "Windows" });
  });

  it("BAUTH-4: reads Safari on iOS, not macOS, even though the UA string says 'like Mac OS X'", () => {
    expect(
      parseDeviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1"),
    ).toEqual({ browser: "Safari", os: "iOS" });
  });

  it("BAUTH-4: reads Edge, not Chrome, on an Edge UA string", () => {
    expect(
      parseDeviceLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0",
      ),
    ).toEqual({ browser: "Edge", os: "Windows" });
  });

  it("BAUTH-4: returns null for both fields on an empty or unrecognised string", () => {
    expect(parseDeviceLabel("")).toEqual({ browser: null, os: null });
    expect(parseDeviceLabel("some-internal-script/1.0")).toEqual({ browser: null, os: null });
  });
});

describe("formatMileage", () => {
  it("FRONT-11: formats kilometres for the Spanish locale with a period thousands separator and NBSP before the unit", () => {
    expect(formatMileage(84000, "es")).toBe("84.000 km");
  });
});
