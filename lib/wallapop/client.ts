import type { WallapopSearchResponse } from "@/interfaces/wallapop";
import type { SearchInput } from "@/lib/search/schema";
import { getUserLocation } from "@/lib/geo/user-location";

const BASE_URL = "/api/wallapop/search";

// Center of Spain — ultimate fallback when both explicit location
// and browser geolocation are unavailable (e.g. permissions denied).
const SPAIN_CENTER = { lat: 40.0, lng: -3.5 };

export interface WallapopQueryOptions {
  lat: number;
  lng: number;
  distance?: number;
  /**
   * Overrides the ordering this function would otherwise pick.
   *
   * The alert runner forces `newest` even when a location is set: relevance is
   * the better ranking for a human reading a list, but an alert polling page one
   * needs the newest listings at the top or it misses them entirely. See
   * docs/specs/alerts.md › Decisions and rationale.
   */
  orderBy?: string;
  nextPage?: string;
}

function addWallapopRangeParams(params: SearchInput, searchParams: URLSearchParams): void {
  if (params.minPrice) searchParams.set("min_sale_price", String(params.minPrice));
  if (params.maxPrice) searchParams.set("max_sale_price", String(params.maxPrice));
  if (params.minKm) searchParams.set("min_km", String(params.minKm));
  if (params.maxKm) searchParams.set("max_km", String(params.maxKm));
  if (params.minYear) searchParams.set("min_year", String(params.minYear));
  if (params.maxYear) searchParams.set("max_year", String(params.maxYear));
  if (params.minHorsePower) searchParams.set("min_horse_power", String(params.minHorsePower));
  if (params.maxHorsePower) searchParams.set("max_horse_power", String(params.maxHorsePower));
}

function addWallapopAttributeParams(params: SearchInput, searchParams: URLSearchParams): void {
  if (params.brand) searchParams.set("brand", params.brand);
  if (params.model) searchParams.set("model", params.model);
  if (params.engine?.length) searchParams.set("engine", params.engine.join(","));
  if (params.gearbox?.length) searchParams.set("gearbox", params.gearbox.join(","));
  if (params.timeFilter) searchParams.set("time_filter", params.timeFilter);
}

/**
 * Builds the Wallapop query. Shared by the browser client below and by the
 * server-side alert runner, which cannot use the client itself because this
 * module resolves its URL against `window.location.origin`.
 */
export function buildWallapopQuery(
  params: SearchInput,
  options: WallapopQueryOptions,
): URLSearchParams {
  const url = new URL("https://placeholder.invalid");
  const hasLocation = params.latitude != null && params.longitude != null;
  const { lat, lng, distance } = options;

  url.searchParams.set("category_id", "100");
  url.searchParams.set("source", "deep_link");
  url.searchParams.set("order_by", options.orderBy ?? (hasLocation ? "most_relevance" : "newest"));
  url.searchParams.set("section_type", "organic_search_results");

  if (params.keywords) url.searchParams.set("keywords", params.keywords);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  if (distance) url.searchParams.set("distance_in_km", String(distance));
  addWallapopRangeParams(params, url.searchParams);
  addWallapopAttributeParams(params, url.searchParams);
  if (options.nextPage) url.searchParams.set("next_page", options.nextPage);

  return url.searchParams;
}

export async function searchWallapop(
  params: SearchInput,
  nextPage?: string,
): Promise<WallapopSearchResponse> {
  const url = new URL(BASE_URL, window.location.origin);
  const hasLocation = params.latitude != null && params.longitude != null;

  // Priority: explicit location > browser geolocation > Spain center.
  // Always send coordinates so Wallapop doesn't geo-filter by server IP
  // (Vercel servers are in the US, which would return US listings).
  const userLoc = getUserLocation();
  url.search = buildWallapopQuery(params, {
    lat: params.latitude ?? userLoc?.lat ?? SPAIN_CENTER.lat,
    lng: params.longitude ?? userLoc?.lng ?? SPAIN_CENTER.lng,
    distance: hasLocation ? params.distanceInKm : 1000,
    nextPage,
  }).toString();

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Wallapop API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<WallapopSearchResponse>;
}
