import { describe, expect, it } from "vitest";
import { formatMileage, formatPrice } from "./format";

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

describe("formatMileage", () => {
  it("FRONT-11: formats kilometres for the Spanish locale with a period thousands separator and NBSP before the unit", () => {
    expect(formatMileage(84000, "es")).toBe("84.000 km");
  });
});
