import { describe, expect, it } from "vitest";
import { searchSchema } from "./schema";

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

  it("MAPUI-14: accepts any year, including before 1900, but rejects a non-integer year", () => {
    expect(searchSchema.safeParse({ minYear: 1899 }).success).toBe(true);
    expect(searchSchema.safeParse({ minYear: 1890 }).success).toBe(true);
    expect(searchSchema.safeParse({ minYear: 2010.5 }).success).toBe(false);
  });

  it("MAPUI-14: accepts a maxKm of 0 but rejects a negative or non-integer maxKm", () => {
    expect(searchSchema.safeParse({ maxKm: 0 }).success).toBe(true);
    expect(searchSchema.safeParse({ maxKm: 100 }).success).toBe(true);
    expect(searchSchema.safeParse({ maxKm: -1 }).success).toBe(false);
    expect(searchSchema.safeParse({ maxKm: 100.5 }).success).toBe(false);
  });

  it("MAPUI-84: accepts a minKm of 0 but rejects a non-integer minKm", () => {
    expect(searchSchema.safeParse({ minKm: 0 }).success).toBe(true);
    expect(searchSchema.safeParse({ minKm: 100.5 }).success).toBe(false);
  });

  it("MAPUI-86: accepts a minKm above maxKm, unchanged — their order is not the schema's concern", () => {
    const result = searchSchema.safeParse({ minKm: 150000, maxKm: 100000 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ minKm: 150000, maxKm: 100000 });
    }
  });

  it("rejects an unknown timeFilter value", () => {
    expect(searchSchema.safeParse({ timeFilter: "lastYear" }).success).toBe(false);
  });

  it("MAP-27: defaults distanceInKm to 50 km when coordinates are given but no radius", () => {
    const result = searchSchema.safeParse({ latitude: 40.4168, longitude: -3.7038 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.distanceInKm).toBe(50);
    }
  });

  it("MAP-27: keeps an explicit distanceInKm when coordinates are given", () => {
    const result = searchSchema.safeParse({
      latitude: 40.4168,
      longitude: -3.7038,
      distanceInKm: 10,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.distanceInKm).toBe(10);
    }
  });

  it("MAP-27: adds no distanceInKm when no coordinates are given", () => {
    const result = searchSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.distanceInKm).toBeUndefined();
    }
  });

  it("MAP-27: adds no distanceInKm when only latitude is given", () => {
    const result = searchSchema.safeParse({ latitude: 40.4168 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.distanceInKm).toBeUndefined();
    }
  });
});
