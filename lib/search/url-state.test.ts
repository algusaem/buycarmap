import { describe, expect, it } from "vitest";
import {
  filtersToUrlState,
  mapSearchUrl,
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

// docs/specs/redesign-entry.md (ENTRY-3), worked example "Landing search",
// verbatim: the one URL builder the landing's desktop search, phone sheet
// and popular-car chips all share.
describe("mapSearchUrl", () => {
  function paramsOf(url: string): URLSearchParams {
    const [path, query = ""] = url.split("?");
    expect(path).toBe("/map");
    return new URLSearchParams(query);
  }

  it("ENTRY-3: nothing chosen goes to /map with no parameters", () => {
    expect(mapSearchUrl(DEFAULTS)).toBe("/map");
  });

  it("ENTRY-3: a place, a car and a price go to /map with every one of them, in any order", () => {
    const url = mapSearchUrl({
      ...DEFAULTS,
      selectedLocation: { placeId: 1, displayName: "Madrid", lat: 40.4168, lng: -3.7038 },
      distanceInKm: 50,
      brand: "Volkswagen",
      model: "Golf",
      maxPrice: 10000,
    });

    const params = paramsOf(url);
    expect(params.get("lat")).toBe("40.4168");
    expect(params.get("lng")).toBe("-3.7038");
    expect(params.get("placeId")).toBe("1");
    expect(params.get("locationName")).toBe("Madrid");
    expect(params.get("radius")).toBe("50");
    expect(params.get("make")).toBe("Volkswagen");
    expect(params.get("model")).toBe("Golf");
    expect(params.get("maxPrice")).toBe("10000");
  });

  it("ENTRY-3: a car alone goes to /map?make=BMW, with no radius even though a default radius is always carried", () => {
    expect(mapSearchUrl({ ...DEFAULTS, brand: "BMW" })).toBe("/map?make=BMW");
  });

  it("ENTRY-3: a non-default radius with no place chosen is still cleared", () => {
    // The hand-written builder this replaces explicitly dropped `radius`
    // whenever no place was chosen, regardless of whether the radius itself
    // was the default — a place can be picked, its radius changed, then
    // cleared again, leaving a non-default radius with no place.
    const url = mapSearchUrl({ ...DEFAULTS, distanceInKm: 25, brand: "BMW" });

    expect(paramsOf(url).has("radius")).toBe(false);
  });

  it("ENTRY-4: a popular chip (brand and model only) goes to /map with just make and model", () => {
    const url = mapSearchUrl({ ...DEFAULTS, brand: "Seat", model: "León" });

    const params = paramsOf(url);
    expect(params.get("make")).toBe("Seat");
    expect(params.get("model")).toBe("León");
    expect(params.has("radius")).toBe(false);
  });

  // F4 review round 2 (T6): a place with a *non-default* radius keeps it —
  // the earlier split/parse/re-add only ever had to add the radius back
  // when it was the parser's own default (50); `clearOnDefault: false`
  // keeps any radius a place carries, default or not.
  it("ENTRY-3: Madrid at 25 km goes to /map with radius=25 plus Madrid's own place params", () => {
    const url = mapSearchUrl({
      ...DEFAULTS,
      selectedLocation: { placeId: 1, displayName: "Madrid", lat: 40.4168, lng: -3.7038 },
      distanceInKm: 25,
    });

    const params = paramsOf(url);
    expect(params.get("radius")).toBe("25");
    expect(params.get("lat")).toBe("40.4168");
    expect(params.get("lng")).toBe("-3.7038");
    expect(params.get("placeId")).toBe("1");
    expect(params.get("locationName")).toBe("Madrid");
  });
});
