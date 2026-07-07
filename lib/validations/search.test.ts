import { describe, expect, it } from "vitest";
import { searchSchema } from "./search";

describe("searchSchema", () => {
  it("accepts a fully-populated valid payload", () => {
    const result = searchSchema.safeParse({
      keywords: "audi a3",
      latitude: 40.4,
      longitude: -3.7,
      distanceInKm: 200,
      minPrice: 0,
      maxPrice: 20000,
      minYear: 2015,
      maxYear: 2022,
      engine: ["gasoil"],
      timeFilter: "lastWeek",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object (all fields optional)", () => {
    expect(searchSchema.safeParse({}).success).toBe(true);
  });

  it("rejects latitude outside [-90, 90]", () => {
    expect(searchSchema.safeParse({ latitude: 91 }).success).toBe(false);
    expect(searchSchema.safeParse({ latitude: -90 }).success).toBe(true);
  });

  it("rejects longitude outside [-180, 180]", () => {
    expect(searchSchema.safeParse({ longitude: 181 }).success).toBe(false);
  });

  it("rejects a non-positive maxPrice but allows minPrice of 0", () => {
    expect(searchSchema.safeParse({ maxPrice: 0 }).success).toBe(false);
    expect(searchSchema.safeParse({ minPrice: 0 }).success).toBe(true);
  });

  it("rejects a distance that is not positive", () => {
    expect(searchSchema.safeParse({ distanceInKm: 0 }).success).toBe(false);
  });

  it("rejects a year before 1900 and a non-integer year", () => {
    expect(searchSchema.safeParse({ minYear: 1899 }).success).toBe(false);
    expect(searchSchema.safeParse({ minYear: 2010.5 }).success).toBe(false);
  });

  it("rejects an unknown timeFilter value", () => {
    expect(searchSchema.safeParse({ timeFilter: "lastYear" }).success).toBe(
      false,
    );
  });
});
