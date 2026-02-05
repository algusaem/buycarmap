import { WallapopSearchResponse } from "@/interfaces/wallapop";
import { SearchInput } from "@/lib/validations/search";

const BASE_URL = "/api/wallapop/search";

export async function searchWallapop(
  params: SearchInput,
  nextPage?: string,
): Promise<WallapopSearchResponse> {
  const url = new URL(BASE_URL, window.location.origin);
  url.searchParams.set("category_id", "100");
  url.searchParams.set("latitude", String(params.latitude));
  url.searchParams.set("longitude", String(params.longitude));
  url.searchParams.set("source", "deep_link");
  url.searchParams.set("order_by", "most_relevance");
  url.searchParams.set("section_type", "organic_search_results");

  if (params.keywords) url.searchParams.set("keywords", params.keywords);
  if (params.distanceInKm)
    url.searchParams.set("distance_in_km", String(params.distanceInKm));
  if (params.minPrice)
    url.searchParams.set("min_sale_price", String(params.minPrice));
  if (params.maxPrice)
    url.searchParams.set("max_sale_price", String(params.maxPrice));
  if (params.brand) url.searchParams.set("brand", params.brand);
  if (params.model) url.searchParams.set("model", params.model);
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
