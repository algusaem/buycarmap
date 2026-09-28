import { describe, expect, it } from "vitest";
import { hashCriteria, isSpecificEnough, MAX_ALERTS_PER_USER, parseStoredCriteria } from "./alerts";

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

describe("MAX_ALERTS_PER_USER", () => {
  it("is a positive bound, since it gates every creation", () => {
    expect(MAX_ALERTS_PER_USER).toBeGreaterThan(0);
  });
});
