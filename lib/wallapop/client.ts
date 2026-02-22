import { WallapopSearchResponse } from "@/interfaces/wallapop";
import { SearchInput } from "@/lib/validations/search";
import { getUserLocation } from "@/lib/geo/user-location";

const BASE_URL = "/api/wallapop/search";

// Center of Spain — ultimate fallback when both explicit location
// and browser geolocation are unavailable (e.g. permissions denied).
const SPAIN_CENTER = { lat: 40.0, lng: -3.5 };

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
  const lat = params.latitude ?? userLoc?.lat ?? SPAIN_CENTER.lat;
  const lng = params.longitude ?? userLoc?.lng ?? SPAIN_CENTER.lng;
  const distance = hasLocation ? params.distanceInKm : 1000;

  url.searchParams.set("category_id", "100");
  url.searchParams.set("source", "deep_link");
  url.searchParams.set("order_by", hasLocation ? "most_relevance" : "newest");
  url.searchParams.set("section_type", "organic_search_results");

  if (params.keywords) url.searchParams.set("keywords", params.keywords);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  if (distance)
    url.searchParams.set("distance_in_km", String(distance));
  if (params.minPrice)
    url.searchParams.set("min_sale_price", String(params.minPrice));
  if (params.maxPrice)
    url.searchParams.set("max_sale_price", String(params.maxPrice));
  if (params.minKm)
    url.searchParams.set("min_km", String(params.minKm));
  if (params.maxKm)
    url.searchParams.set("max_km", String(params.maxKm));
  if (params.minYear)
    url.searchParams.set("min_year", String(params.minYear));
  if (params.maxYear)
    url.searchParams.set("max_year", String(params.maxYear));
  if (params.minHorsePower)
    url.searchParams.set("min_horse_power", String(params.minHorsePower));
  if (params.maxHorsePower)
    url.searchParams.set("max_horse_power", String(params.maxHorsePower));
  if (params.brand) url.searchParams.set("brand", params.brand);
  if (params.model) url.searchParams.set("model", params.model);
  if (params.engine?.length)
    url.searchParams.set("engine", params.engine.join(","));
  if (params.gearbox?.length)
    url.searchParams.set("gearbox", params.gearbox.join(","));
  if (params.timeFilter)
    url.searchParams.set("time_filter", params.timeFilter);
  if (nextPage) url.searchParams.set("next_page", nextPage);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Wallapop API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<WallapopSearchResponse>;
}
