import { describe, expect, it } from "vitest";
import { ALERT_ID } from "@/test/fixtures/alert-listings";
import {
  alertCriteriaSchema,
  alertPlaceNameSchema,
  isSpecificEnough,
  parseStoredCriteria,
} from "./schema";
import { hashCriteria, MAX_ALERTS_PER_USER, resolveOpenAlertId } from "./service";

describe("hashCriteria", () => {
  it("gives the same hash regardless of key order", () => {
    // Two users building the same filters through different UI paths produce
    // objects with different key order. Hashing raw would give two criteria
    // rows for one question, and the dedup is what keeps polling affordable.
    const a = hashCriteria({ brand: "Audi", maxPrice: 20000, model: "A3" });
    const b = hashCriteria({ model: "A3", brand: "Audi", maxPrice: 20000 });

    expect(a).toBe(b);
  });

  it("gives the same hash regardless of order within a multi-select", () => {
    // `engine` and `gearbox` are unordered sets on the UI side.
    const a = hashCriteria({ brand: "Audi", engine: ["gasoil", "gasoline"] });
    const b = hashCriteria({ brand: "Audi", engine: ["gasoline", "gasoil"] });

    expect(a).toBe(b);
  });

  it("ignores fields explicitly set to undefined", () => {
    // `toParams` in useSearchFilters emits `undefined` for cleared filters, so
    // "never set" and "set then cleared" must not be different questions.
    const a = hashCriteria({ brand: "Audi", model: undefined });
    const b = hashCriteria({ brand: "Audi" });

    expect(a).toBe(b);
  });

  it("gives different hashes for criteria that differ in any value", () => {
    const a = hashCriteria({ brand: "Audi", maxPrice: 20000 });
    const b = hashCriteria({ brand: "Audi", maxPrice: 20001 });

    expect(a).not.toBe(b);
  });

  it("does not collide across fields carrying the same value", () => {
    // A naive "concatenate the values" hash would make these identical.
    const a = hashCriteria({ minKm: 1000, maxKm: 2000 });
    const b = hashCriteria({ minKm: 2000, maxKm: 1000 });

    expect(a).not.toBe(b);
  });

  it("produces a hex sha-256 digest", () => {
    expect(hashCriteria({ brand: "Audi" })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("isSpecificEnough", () => {
  it.each([
    ["a brand", { brand: "Audi" }],
    ["a maximum price", { maxPrice: 20000 }],
    ["a location", { latitude: 40.4168, longitude: -3.7038 }],
  ])("accepts criteria naming %s", (_label, criteria) => {
    expect(isSpecificEnough(criteria)).toBe(true);
  });

  it("rejects criteria naming none of the three", () => {
    // "Every car in Spain": thousands on the seed poll, matching on nearly
    // every lap, and useless as an alert because it never stops firing.
    expect(isSpecificEnough({ minYear: 2010, engine: ["gasoil"] })).toBe(false);
  });

  it("rejects an empty criteria set", () => {
    expect(isSpecificEnough({})).toBe(false);
  });

  it("does not accept a half-specified location", () => {
    // A latitude with no longitude cannot narrow anything.
    expect(isSpecificEnough({ latitude: 40.4168 })).toBe(false);
    expect(isSpecificEnough({ longitude: -3.7038 })).toBe(false);
  });

  it("treats a minimum price as no narrowing at all", () => {
    // "At least €500" excludes almost nothing, unlike a ceiling.
    expect(isSpecificEnough({ minPrice: 500 })).toBe(false);
  });
});

describe("parseStoredCriteria", () => {
  it("returns the criteria when the stored JSON still matches the schema", () => {
    const parsed = parseStoredCriteria({ brand: "Audi", maxPrice: 20000 });

    expect(parsed).toEqual({ brand: "Audi", maxPrice: 20000 });
  });

  it("rejects stored JSON that no longer matches the schema", () => {
    // The column is Json, so what comes out is not typed just because what went
    // in was — a migration or a manual edit would otherwise reach the clients.
    expect(parseStoredCriteria({ maxPrice: -5 })).toBeNull();
    expect(parseStoredCriteria({ timeFilter: "lastYear" })).toBeNull();
  });

  it("rejects a value that is not an object at all", () => {
    expect(parseStoredCriteria(null)).toBeNull();
    expect(parseStoredCriteria("brand=Audi")).toBeNull();
  });
});

// docs/specs/map-description-search.md (DESC-23): keywords absent, empty or
// only spaces all hash the same as criteria with no keywords at all.
describe("DESC-23: alertCriteriaSchema normalizes blank keywords", () => {
  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["only spaces", "   "],
  ])("DESC-23: keywords %s parses to criteria with no keywords field", (_label, keywords) => {
    const parsed = alertCriteriaSchema.parse({ brand: "Audi", keywords });

    expect(parsed).toEqual({ brand: "Audi" });
  });

  it("DESC-23: a blank text hashes the same as no text at all, so an existing alert is still «Ya tienes esta alerta»", () => {
    const withoutText = alertCriteriaSchema.parse({ brand: "Audi" });
    const blank = alertCriteriaSchema.parse({ brand: "Audi", keywords: "   " });

    expect(hashCriteria(blank)).toBe(hashCriteria(withoutText));
  });
});

// docs/specs/map-description-search.md (DESC-24; worked example): the text
// alone does not satisfy «Demasiado amplia»; a brand, a maximum price or a
// place does.
describe("DESC-24: isSpecificEnough and the text alone", () => {
  it("DESC-24: criteria with only keywords are refused — too broad", () => {
    expect(isSpecificEnough({ keywords: "e46" })).toBe(false);
  });

  it("DESC-24: adding a brand accepts them", () => {
    expect(isSpecificEnough({ brand: "BMW", keywords: "e46" })).toBe(true);
  });

  it("DESC-24: adding a maximum price accepts them", () => {
    expect(isSpecificEnough({ maxPrice: 20000, keywords: "e46" })).toBe(true);
  });

  it("DESC-24: adding a place accepts them", () => {
    expect(isSpecificEnough({ latitude: 40.4168, longitude: -3.7038, keywords: "e46" })).toBe(true);
  });
});

// docs/specs/map-description-search.md (DESC-31): a text a Postgres `jsonb`
// column cannot store is refused as invalid criteria.
describe("DESC-31: alertCriteriaSchema refuses text jsonb cannot store", () => {
  it("DESC-31: a NUL byte is refused as invalidCriteria", () => {
    const result = alertCriteriaSchema.safeParse({ brand: "BMW", keywords: "a\u0000b" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("invalidCriteria");
  });

  it("DESC-31: a lone surrogate is refused as invalidCriteria", () => {
    const result = alertCriteriaSchema.safeParse({ brand: "BMW", keywords: "a\ud800b" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("invalidCriteria");
  });

  it("DESC-31: a properly paired surrogate (an emoji) is not mistaken for a lone one and is accepted", () => {
    const result = alertCriteriaSchema.safeParse({ brand: "BMW", keywords: "🚗 e46" });

    expect(result.success).toBe(true);
  });
});

describe("MAX_ALERTS_PER_USER", () => {
  it("is a positive bound, since it gates every creation", () => {
    expect(MAX_ALERTS_PER_USER).toBeGreaterThan(0);
  });
});

// docs/specs/redesign-alerts.md (ALERTUI-12; worked example "Open alert"):
// the open alert resolved from the URL's `alert` against the caller's own
// alerts, newest first. Anything that is not one of them reads as the newest,
// with no error.
describe("ALERTUI-12: resolveOpenAlertId", () => {
  const ADAS = [ALERT_ID.corolla, ALERT_ID.golf, ALERT_ID.clio, ALERT_ID.serie3];

  it("ALERTUI-12: with no `alert`, the newest — Corolla híbrido", () => {
    expect(resolveOpenAlertId(ADAS, null)).toBe(ALERT_ID.corolla);
    expect(resolveOpenAlertId(ADAS, undefined)).toBe(ALERT_ID.corolla);
  });

  it("ALERTUI-12: one of the user's alerts is that alert — Clio barato", () => {
    expect(resolveOpenAlertId(ADAS, ALERT_ID.clio)).toBe(ALERT_ID.clio);
  });

  it.each([
    ["empty", ""],
    ["malformed", "not-a-uuid"],
    ["another user's", ALERT_ID.grace],
    ["deleted or unknown", "0199a000-0000-7000-8000-0000000dead1"],
  ])("ALERTUI-12: an %s id reads as the newest", (_case, requested) => {
    expect(resolveOpenAlertId(ADAS, requested)).toBe(ALERT_ID.corolla);
  });

  it("ALERTUI-12: with no alert at all, nothing is open", () => {
    expect(resolveOpenAlertId([], ALERT_ID.clio)).toBeNull();
    expect(resolveOpenAlertId([], null)).toBeNull();
  });
});

// docs/specs/redesign-alerts.md (ALERTUI-47; Contracts › Server): the place
// name createAlert takes is optional, trimmed, and null when empty.
describe("ALERTUI-47: alertPlaceNameSchema", () => {
  it.each([
    ["Madrid", "Madrid"],
    ["  Getafe  ", "Getafe"],
    ["   ", null],
    ["", null],
    [undefined, null],
  ])("ALERTUI-47: %j is stored as %j", (sent, stored) => {
    expect(alertPlaceNameSchema.parse(sent)).toBe(stored);
  });

  it("ALERTUI-47: a place name is at most 200 characters — 200 is stored, 201 is refused", () => {
    expect(alertPlaceNameSchema.parse("M".repeat(200))).toBe("M".repeat(200));
    expect(alertPlaceNameSchema.safeParse("M".repeat(201)).success).toBe(false);
  });

  it("ALERTUI-47: the place name is trimmed before its length is checked — 195 «M» with 3 spaces on each side is stored as the 195", () => {
    const padded = `   ${"M".repeat(195)}   `;
    expect(padded).toHaveLength(201);

    expect(alertPlaceNameSchema.parse(padded)).toBe("M".repeat(195));
  });
});
