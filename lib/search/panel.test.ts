import { describe, expect, it } from "vitest";
import { chosenGearbox, hasPanelCriteria, orderedKm, PANEL_KEYS, panelCriteria } from "./panel";

// docs/specs/redesign-map.md (MAPUI-16, worked example "Gearbox"; MAPUI-18,
// MAPUI-19).
describe("chosenGearbox (MAPUI-16)", () => {
  it("MAPUI-16: gearbox=manual reads Manual", () => {
    expect(chosenGearbox(["manual"])).toBe("manual");
  });

  it("MAPUI-16: gearbox=automatic reads Automático", () => {
    expect(chosenGearbox(["automatic"])).toBe("automatic");
  });

  it("MAPUI-16: gearbox=manual,automatic reads Todos", () => {
    expect(chosenGearbox(["manual", "automatic"])).toBeUndefined();
  });

  it("MAPUI-16: no gearbox, or only one the UI no longer offers (MAPUI-18), reads Todos", () => {
    expect(chosenGearbox(undefined)).toBeUndefined();
    expect(chosenGearbox([])).toBeUndefined();
    expect(chosenGearbox(["semiautomatic"])).toBeUndefined();
  });

  it("MAPUI-16: an offered gearbox next to one no longer offered still reads as chosen", () => {
    expect(chosenGearbox(["manual", "semiautomatic"])).toBe("manual");
  });
});

describe("panelCriteria (MAPUI-18, MAPUI-19)", () => {
  it("MAPUI-19: from an empty input it names every panel criterion as cleared, the removed ones included", () => {
    expect(panelCriteria({})).toEqual({
      minPrice: undefined,
      maxPrice: undefined,
      engine: undefined,
      gearbox: undefined,
      maxKm: undefined,
      minYear: undefined,
      timeFilter: undefined,
      brand: undefined,
      model: undefined,
      minKm: undefined,
      maxYear: undefined,
      minHorsePower: undefined,
      maxHorsePower: undefined,
    });
    expect(Object.keys(panelCriteria({}))).toHaveLength(PANEL_KEYS.length);
  });

  it("MAPUI-19: keeps the panel's criteria and leaves out the place, the radius and the text", () => {
    expect(
      panelCriteria({
        keywords: "golf",
        brand: "Toyota",
        maxKm: 100000,
        latitude: 40.4168,
        longitude: -3.7038,
        distanceInKm: 25,
      }),
    ).toEqual({
      minPrice: undefined,
      maxPrice: undefined,
      engine: undefined,
      gearbox: undefined,
      maxKm: 100000,
      minYear: undefined,
      timeFilter: undefined,
      brand: "Toyota",
      model: undefined,
      minKm: undefined,
      maxYear: undefined,
      minHorsePower: undefined,
      maxHorsePower: undefined,
    });
  });
});

describe("MAPUI-31: hasPanelCriteria — is a filter active beyond the place?", () => {
  it("MAPUI-31: Madrid, 50 km, nothing else has no filter", () => {
    expect(hasPanelCriteria({ latitude: 40.4168, longitude: -3.7038, distanceInKm: 50 })).toBe(
      false,
    );
  });

  it("MAPUI-31: the ?q= text alone is not a panel criterion", () => {
    expect(hasPanelCriteria({ keywords: "golf" })).toBe(false);
  });

  it("MAPUI-31: a maximum price is a filter", () => {
    expect(hasPanelCriteria({ maxPrice: 20000 })).toBe(true);
  });

  it("MAPUI-31: a criterion the UI no longer offers (maxHorsePower) is a filter", () => {
    expect(hasPanelCriteria({ maxHorsePower: 150 })).toBe(true);
  });

  it("MAPUI-72: a minimum mileage alone is a filter", () => {
    expect(hasPanelCriteria({ minKm: 50000 })).toBe(true);
  });
});

describe("MAPUI-74: orderedKm — a typed minimum above the maximum is swapped", () => {
  it("MAPUI-74: a minimum above the maximum is swapped", () => {
    expect(orderedKm({ minKm: 150000, maxKm: 100000 })).toEqual({ minKm: 100000, maxKm: 150000 });
  });

  it("MAPUI-74: a minimum of 5000 above a maximum of 0 is swapped too", () => {
    expect(orderedKm({ minKm: 5000, maxKm: 0 })).toEqual({ minKm: 0, maxKm: 5000 });
  });

  it("MAPUI-74: a minimum alone, with no maximum to compare it to, is left as it is", () => {
    expect(orderedKm({ minKm: 150000, maxKm: undefined })).toEqual({
      minKm: 150000,
      maxKm: undefined,
    });
  });

  it("MAPUI-74: a maximum alone, with no minimum to compare it to, is left as it is", () => {
    expect(orderedKm({ minKm: undefined, maxKm: 100000 })).toEqual({
      minKm: undefined,
      maxKm: 100000,
    });
  });
});
