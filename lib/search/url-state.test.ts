import { describe, expect, it } from "vitest";
import {
  filtersToUrlState,
  urlStateToFilters,
  type UrlFilterValues,
  type UrlSearchState,
} from "./url-state";

const DEFAULTS: UrlFilterValues = {
  engine: [],
  gearbox: [],
  brand: "",
  model: "",
  minPrice: undefined,
  maxPrice: undefined,
  minKm: undefined,
  maxKm: undefined,
  minYear: undefined,
  maxYear: undefined,
  minHorsePower: undefined,
  maxHorsePower: undefined,
  timeFilter: "",
  selectedLocation: undefined,
  distanceInKm: 50,
};

const EMPTY_URL_STATE: UrlSearchState = {
  engine: [],
  gearbox: [],
  make: "",
  model: "",
  minPrice: null,
  maxPrice: null,
  minKm: null,
  maxKm: null,
  minYear: null,
  maxYear: null,
  minHorsePower: null,
  maxHorsePower: null,
  timeFilter: "",
  lat: null,
  lng: null,
  placeId: null,
  locationName: null,
  radius: 50,
};

describe("filtersToUrlState", () => {
  it("FRONT-13: maps brand to the make param and distanceInKm to radius", () => {
    const state = filtersToUrlState({ ...DEFAULTS, brand: "Seat", distanceInKm: 25 });

    expect(state.make).toBe("Seat");
    expect(state.radius).toBe(25);
  });

  it("FRONT-13: maps an undefined numeric filter to null", () => {
    const state = filtersToUrlState({ ...DEFAULTS, maxPrice: undefined });

    expect(state.maxPrice).toBeNull();
  });

  it("FRONT-13: maps a selected location to its four params", () => {
    const state = filtersToUrlState({
      ...DEFAULTS,
      selectedLocation: { placeId: 1, displayName: "Madrid", lat: 40.4168, lng: -3.7038 },
    });

    expect(state.lat).toBe(40.4168);
    expect(state.lng).toBe(-3.7038);
    expect(state.placeId).toBe(1);
    expect(state.locationName).toBe("Madrid");
  });

  it("FRONT-13: maps no selected location to null for all four params", () => {
    const state = filtersToUrlState(DEFAULTS);

    expect(state.lat).toBeNull();
    expect(state.lng).toBeNull();
    expect(state.placeId).toBeNull();
    expect(state.locationName).toBeNull();
  });
});

describe("urlStateToFilters", () => {
  it("FRONT-13: the spec's worked example — make=seat&maxPrice=10000&radius=50", () => {
    const filters = urlStateToFilters(
      { ...EMPTY_URL_STATE, make: "seat", maxPrice: 10000, radius: 50 },
      DEFAULTS,
    );

    expect(filters.brand).toBe("seat");
    expect(filters.maxPrice).toBe(10000);
    expect(filters.distanceInKm).toBe(50);
  });

  it("FRONT-13: falls back to the given defaults for an absent param", () => {
    const filters = urlStateToFilters(EMPTY_URL_STATE, DEFAULTS);

    expect(filters).toEqual(DEFAULTS);
  });

  it("FRONT-13: only builds a selectedLocation when all four location params are present", () => {
    const filters = urlStateToFilters({ ...EMPTY_URL_STATE, lat: 40.4168 }, DEFAULTS);

    expect(filters.selectedLocation).toBeUndefined();
  });

  it("FRONT-13: rebuilds the selected location from lat, lng, placeId and locationName", () => {
    const filters = urlStateToFilters(
      { ...EMPTY_URL_STATE, lat: 40.4168, lng: -3.7038, placeId: 1, locationName: "Madrid" },
      DEFAULTS,
    );

    expect(filters.selectedLocation).toEqual({
      lat: 40.4168,
      lng: -3.7038,
      placeId: 1,
      displayName: "Madrid",
    });
  });

  it("FRONT-13: rejects a timeFilter value outside the known set, falling back to the default", () => {
    const filters = urlStateToFilters({ ...EMPTY_URL_STATE, timeFilter: "nonsense" }, DEFAULTS);

    expect(filters.timeFilter).toBe("");
  });
});
