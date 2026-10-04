import { describe, expect, it } from "vitest";
import { formatMileage, formatPrice, parseDeviceLabel } from "./format";

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
