// "nuqs/server", not "nuqs": the plain "nuqs" entry is "use client" (it also
// exports the useQueryState(s) hooks), and this module is now imported from
// Landing.tsx, a Server Component (ENTRY-4's popular-car links) — pulling a
// client-tagged module into a server module graph throws at module
// evaluation. Every export used here is a plain function, identical on both
// entry points.
import {
  createSerializer,
  parseAsArrayOf,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  type inferParserType,
} from "nuqs/server";
import type { SelectedLocation } from "@/interfaces/location";
import { DEFAULT_RADIUS_KM } from "@/lib/search/schema";

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

// The landing's desktop search, phone sheet and popular-car chips all start
// from this (docs/specs/redesign-entry.md, Contracts › "Landing to map"), so
// no filter stays set once a chip or a cleared field is applied to it.
export const EMPTY_URL_FILTERS: UrlFilterValues = {
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
  distanceInKm: DEFAULT_RADIUS_KM,
};

// `radius` alone keeps a value equal to its own default (ENTRY-3's worked
// example "Dónde «Madrid» (50 km)") — nuqs' own `clearOnDefault` would
// otherwise drop it from the URL like any other default, the same as every
// other field here.
const mapUrlSerializer = createSerializer({
  ...searchParsers,
  radius: searchParsers.radius.withOptions({ clearOnDefault: false }),
});

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

/**
 * `/map` with exactly the given filters, built through `searchParsers`'
 * own serializer (docs/specs/redesign-entry.md, Contracts › "Landing to
 * map") so the parameter names and shapes are exactly those the map reads —
 * the one URL builder the landing's desktop search, its phone sheet and its
 * popular-car chips all share, instead of each hand-rolling its own
 * `URLSearchParams`. The radius only means anything once a place is chosen
 * (worked example "Dónde «Madrid» (50 km)" keeps it even at its default, via
 * `mapUrlSerializer`'s `clearOnDefault: false`), so it is cleared outright,
 * `null`, whenever one is not — even though `filtersToUrlState` always
 * carries one.
 */
export function mapSearchUrl(filters: UrlFilterValues): string {
  const state = filtersToUrlState(filters);
  return mapUrlSerializer("/map", {
    ...state,
    radius: filters.selectedLocation ? state.radius : null,
  });
}

/**
 * An old link's free text (`/map?q=…`): still parsed and searched, never
 * shown and never produced by anything in the app (MAPUI-18, amended by
 * docs/specs/redesign-entry.md's ENTRY-6 — the landing builds its own
 * `/map` links through `mapSearchUrl` above, never this). Not one of
 * `searchParsers`: the map's caller of useSearchFilters owns it, and the
 * hook drops it once a control clears it.
 */
export const KEYWORDS_PARAM = "q";

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
