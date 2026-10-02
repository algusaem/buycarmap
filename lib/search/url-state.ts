import {
  parseAsArrayOf,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  type inferParserType,
} from "nuqs";
import type { SelectedLocation } from "@/interfaces/location";

// FRONT-13 (docs/specs/core-frontend.md): the search filters, location and
// radius live in the URL through these nuqs parsers. Param names follow the
// spec's worked example (`make`, `maxPrice`, `radius`) for the fields it
// names explicitly; the rest take the internal filter field's own name,
// since there was no previous URL state to keep compatible with (the UI
// never put filters in the URL before this phase).
export const searchParsers = {
  engine: parseAsArrayOf(parseAsString).withDefault([]),
  gearbox: parseAsArrayOf(parseAsString).withDefault([]),
  make: parseAsString.withDefault(""),
  model: parseAsString.withDefault(""),
  minPrice: parseAsInteger,
  maxPrice: parseAsInteger,
  minKm: parseAsInteger,
  maxKm: parseAsInteger,
  minYear: parseAsInteger,
  maxYear: parseAsInteger,
  minHorsePower: parseAsInteger,
  maxHorsePower: parseAsInteger,
  timeFilter: parseAsString.withDefault(""),
  lat: parseAsFloat,
  lng: parseAsFloat,
  placeId: parseAsInteger,
  locationName: parseAsString,
  radius: parseAsFloat.withDefault(50),
};

export type UrlSearchState = inferParserType<typeof searchParsers>;

// The subset of `useSearchFilters`' `FilterValues` this module knows how to
// read from and write to the URL — kept as a narrow shape here rather than
// importing `FilterValues` itself, so this module has no dependency on the
// hook and the hook stays the one place that owns that type.
export interface UrlFilterValues {
  engine: string[];
  gearbox: string[];
  brand: string;
  model: string;
  minPrice: number | undefined;
  maxPrice: number | undefined;
  minKm: number | undefined;
  maxKm: number | undefined;
  minYear: number | undefined;
  maxYear: number | undefined;
  minHorsePower: number | undefined;
  maxHorsePower: number | undefined;
  timeFilter: "" | "today" | "lastWeek" | "lastMonth";
  selectedLocation: SelectedLocation | undefined;
  distanceInKm: number;
}

/** Full URL state for the given filters — every key, so a commit overwrites stale values rather than leaving them behind. */
export function filtersToUrlState(filters: UrlFilterValues): UrlSearchState {
  return {
    engine: filters.engine,
    gearbox: filters.gearbox,
    make: filters.brand,
    model: filters.model,
    minPrice: filters.minPrice ?? null,
    maxPrice: filters.maxPrice ?? null,
    minKm: filters.minKm ?? null,
    maxKm: filters.maxKm ?? null,
    minYear: filters.minYear ?? null,
    maxYear: filters.maxYear ?? null,
    minHorsePower: filters.minHorsePower ?? null,
    maxHorsePower: filters.maxHorsePower ?? null,
    timeFilter: filters.timeFilter,
    lat: filters.selectedLocation?.lat ?? null,
    lng: filters.selectedLocation?.lng ?? null,
    placeId: filters.selectedLocation?.placeId ?? null,
    locationName: filters.selectedLocation?.displayName ?? null,
    radius: filters.distanceInKm,
  };
}

const VALID_TIME_FILTERS = new Set(["today", "lastWeek", "lastMonth"]);

/** Merges URL state onto the given defaults — used to seed the hook's initial filters from a deep link. */
export function urlStateToFilters(
  state: UrlSearchState,
  defaults: UrlFilterValues,
): UrlFilterValues {
  const hasLocation =
    state.lat !== null &&
    state.lng !== null &&
    state.placeId !== null &&
    state.locationName !== null;

  return {
    engine: state.engine.length > 0 ? state.engine : defaults.engine,
    gearbox: state.gearbox.length > 0 ? state.gearbox : defaults.gearbox,
    brand: state.make || defaults.brand,
    model: state.model || defaults.model,
    minPrice: state.minPrice ?? defaults.minPrice,
    maxPrice: state.maxPrice ?? defaults.maxPrice,
    minKm: state.minKm ?? defaults.minKm,
    maxKm: state.maxKm ?? defaults.maxKm,
    minYear: state.minYear ?? defaults.minYear,
    maxYear: state.maxYear ?? defaults.maxYear,
    minHorsePower: state.minHorsePower ?? defaults.minHorsePower,
    maxHorsePower: state.maxHorsePower ?? defaults.maxHorsePower,
    timeFilter: VALID_TIME_FILTERS.has(state.timeFilter)
      ? (state.timeFilter as UrlFilterValues["timeFilter"])
      : defaults.timeFilter,
    selectedLocation: hasLocation
      ? {
          lat: state.lat as number,
          lng: state.lng as number,
          placeId: state.placeId as number,
          displayName: state.locationName as string,
        }
      : defaults.selectedLocation,
    distanceInKm: state.radius,
  };
}
