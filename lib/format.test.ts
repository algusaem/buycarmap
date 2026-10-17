import { describe, expect, it } from "vitest";
import {
  formatAmount,
  formatDate,
  formatDeviceLabel,
  formatMileage,
  formatMonth,
  formatPrice,
  parseDeviceLabel,
} from "./format";
import esMessages from "@/messages/es.json";

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
    // Amended 2026-10-15 (FRONT-11, ALERTUI-10 — redesign-alerts.md): formatDate
    // comes back for «Creada el …», an absolute date, not a price formatter.
    // Amended 2026-10-16 (PAGES-31, PAGES-52 — redesign-pages.md): formatMonth
    // («en BuyCarMap desde marzo») and formatDeviceLabel («Chrome en Windows»)
    // join it, a month and a device, not price formatters.
    expect(formatters).toEqual([
      "formatAmount",
      "formatDate",
      "formatDeviceLabel",
      "formatMileage",
      "formatMonth",
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

// BAUTH-4 (docs/specs/core-better-auth.md): the «Sesiones» dialog on
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

// docs/specs/redesign-alerts.md (ALERTUI-10; amends FRONT-11; worked example
// "Created on"). Today is 2026-10-15; Europe/Madrid is UTC+2 until
// 2026-10-25 and UTC+1 in winter, so 22:30 UTC on 30 September is 00:30 on
// 1 October there, and 23:30 UTC on 31 December 2025 is 00:30 on 1 January
// 2026 — the current year, so no year is written.
describe("ALERTUI-10: formatDate — «Creada el …»", () => {
  const NOW = new Date("2026-10-15T12:00:00.000Z");

  it.each([
    ["2026-10-02T10:00:00.000Z", "Europe/Madrid", "2 de octubre", "2 October"],
    ["2026-09-30T22:30:00.000Z", "Europe/Madrid", "1 de octubre", "1 October"],
    ["2026-09-30T22:30:00.000Z", "UTC", "30 de septiembre", "30 September"],
    ["2025-12-20T12:00:00.000Z", "Europe/Madrid", "20 de diciembre de 2025", "20 December 2025"],
    ["2025-12-31T23:30:00.000Z", "Europe/Madrid", "1 de enero", "1 January"],
    ["2025-12-31T23:30:00.000Z", "UTC", "31 de diciembre de 2025", "31 December 2025"],
  ])("ALERTUI-10: %s in %s reads «%s» in es and %s in en", (createdAt, timeZone, es, en) => {
    expect(formatDate(new Date(createdAt), "es", timeZone, NOW)).toBe(es);
    expect(formatDate(new Date(createdAt), "en", timeZone, NOW)).toBe(en);
  });

  it("ALERTUI-10: the current year is read in the same time zone — 31 December 2026 23:30 UTC, seen at 23:45 UTC, is 1 January in Madrid and 31 December in UTC, neither with a year", () => {
    // Madrid is UTC+1 in winter: the date is 1 January 2027 there, and on
    // that same day the current year in Madrid is 2027, so no year is shown;
    // read in UTC, both are 31 December 2026, also with no year.
    const now = new Date("2026-12-31T23:45:00.000Z");
    expect(formatDate(new Date("2026-12-31T23:30:00.000Z"), "es", "Europe/Madrid", now)).toBe(
      "1 de enero",
    );
    expect(formatDate(new Date("2026-12-31T23:30:00.000Z"), "es", "UTC", now)).toBe(
      "31 de diciembre",
    );
  });
});

// docs/specs/redesign-pages.md (PAGES-31, worked example "Summary line"):
// «en BuyCarMap desde <mes>», the month User.createdAt falls in, with the
// year appended only when it is not `now`'s (in the same time zone). Today is
// 2026-10-16. `formatMonth` is the function the spec's Contracts section says
// lives "beside formatDate".
describe("PAGES-31: formatMonth — «en BuyCarMap desde <mes>»", () => {
  const NOW = new Date("2026-10-16T12:00:00.000Z");

  it.each([
    ["2026-03-10T10:00:00.000Z", "UTC", "marzo"],
    ["2025-03-10T10:00:00.000Z", "UTC", "marzo de 2025"],
    ["2025-03-31T23:30:00.000Z", "UTC", "marzo de 2025"],
    // Europe/Madrid is UTC+2 in summer: 2025-03-31T23:30:00Z is 01:30 on 1 April there.
    ["2025-03-31T23:30:00.000Z", "Europe/Madrid", "abril de 2025"],
    ["2025-12-31T23:30:00.000Z", "UTC", "diciembre de 2025"],
    // Europe/Madrid is UTC+1 in winter: 2025-12-31T23:30:00Z is 00:30 on 1 January 2026
    // there — the current year, so no year is appended.
    ["2025-12-31T23:30:00.000Z", "Europe/Madrid", "enero"],
  ])("PAGES-31: %s in %s reads «%s»", (createdAt, timeZone, expected) => {
    expect(formatMonth(new Date(createdAt), "es", timeZone, NOW)).toBe(expected);
  });

  // The English copy is drafted for the PR (the spec's i18n keys): the
  // month alone in the same year, then the month and the year.
  it("PAGES-31: in English, the same year reads the month alone", () => {
    expect(formatMonth(new Date("2026-03-10T10:00:00Z"), "en", "UTC", NOW)).toBe("March");
  });

  it("PAGES-31: in English, another year reads «March 2025»", () => {
    expect(formatMonth(new Date("2025-03-10T10:00:00Z"), "en", "UTC", NOW)).toBe("March 2025");
  });
});

// docs/specs/redesign-pages.md (PAGES-52, worked example "Device"):
// «<navegador> en <sistema>» when both are known, the one known alone
// otherwise, and the caller's own fallback when neither is — the account
// cards' and the sessions dialog's device line, amending today's "·" join
// (the old SessionsCard's deviceLabelText). The join is the caller's
// translated `account.sessions.device`, here the Spanish message itself.
describe("PAGES-52: formatDeviceLabel — «<navegador> en <sistema>»", () => {
  const UNKNOWN = "Dispositivo desconocido";
  const JOIN = ({ browser, os }: { browser: string; os: string }) =>
    esMessages.account.sessions.device.replace("{browser}", browser).replace("{os}", os);

  it("PAGES-52: Chrome on Windows reads «Chrome en Windows»", () => {
    expect(
      formatDeviceLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
        JOIN,
        UNKNOWN,
      ),
    ).toBe("Chrome en Windows");
  });

  it("PAGES-52: Safari on an iPhone reads «Safari en iOS» — the user agent gives the system, not the device", () => {
    expect(
      formatDeviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1",
        JOIN,
        UNKNOWN,
      ),
    ).toBe("Safari en iOS");
  });

  it("PAGES-52: Firefox with the system unknown reads «Firefox» alone", () => {
    expect(formatDeviceLabel("Firefox/121.0", JOIN, UNKNOWN)).toBe("Firefox");
  });

  it("PAGES-52: a system with no known browser reads the system alone", () => {
    expect(formatDeviceLabel("Mozilla/5.0 (X11; Linux x86_64)", JOIN, UNKNOWN)).toBe("Linux");
  });

  it("PAGES-52: neither known, or an empty string, reads the caller's own fallback", () => {
    expect(formatDeviceLabel("", JOIN, UNKNOWN)).toBe(UNKNOWN);
    expect(formatDeviceLabel("some-internal-script/1.0", JOIN, UNKNOWN)).toBe(UNKNOWN);
  });
});
