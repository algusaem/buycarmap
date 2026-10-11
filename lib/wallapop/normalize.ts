import type { CarListing } from "@/interfaces/listing";
import type { WallapopItem } from "@/interfaces/wallapop";
import { getCityCoordinates, SPAIN_CENTER } from "@/lib/geo/cities";

const WALLAPOP_BASE_URL = "https://es.wallapop.com/item";

// Resolve coordinates for an item with no latitude/longitude: try the exact
// city name, then the region name, then the shared country centre — the same
// chain and the same SPAIN_CENTER constant coches.net and Milanuncios fall
// back to (lib/cochesnet/geo.ts, lib/milanuncios/geo.ts). Unlike those two,
// Wallapop carries no INE province id — only the autonomous-community name in
// `location.region` — so there is no province-capital centroid table step here.
function resolveWallapopCoords(city: string, region: string): { lat: number; lng: number } {
  const cityMatch = getCityCoordinates(city, NaN, NaN);
  if (!Number.isNaN(cityMatch.lat)) return cityMatch;

  const regionMatch = getCityCoordinates(region, NaN, NaN);
  if (!Number.isNaN(regionMatch.lat)) return regionMatch;

  return SPAIN_CENTER;
}

// Coordinates for one item: the item's own lat/lng when present, otherwise
// the city/region/country-centre chain above. Pulled out of the map callback
// below to keep its complexity down.
function resolveListingCoords(location: WallapopItem["location"]): { lat: number; lng: number } {
  const hasCoords = location?.latitude != null && location?.longitude != null;
  if (hasCoords) {
    return { lat: location.latitude, lng: location.longitude };
  }
  return resolveWallapopCoords(location?.city ?? "", location?.region ?? "");
}

export function normalizeWallapopItems(items: WallapopItem[]): CarListing[] {
  return items
    .filter((item) => !item.reserved?.flag)
    .map((item): CarListing | null => {
      const city = item.location?.city ?? "";
      const { lat, lng } = resolveListingCoords(item.location);

      const image = item.images?.[0]?.urls?.big ?? item.images?.[0]?.urls?.medium ?? "";
      const slug = item.web_slug ?? item.id;
      const attrs = item.type_attributes;

      return {
        id: `wallapop-${item.id}`,
        image,
        title: item.title ?? "Unknown",
        subtitle: item.description?.slice(0, 80) ?? "",
        price: item.price?.amount ?? 0,
        mileage: attrs?.km ?? 0,
        year: attrs?.year ?? 0,
        fuel: attrs?.engine ?? "",
        brand: attrs?.brand ?? "",
        model: attrs?.model ?? "",
        location: city,
        source: "Wallapop",
        lat,
        lng,
        url: `${WALLAPOP_BASE_URL}/${slug}`,
      };
    })
    .filter((listing): listing is CarListing => listing !== null);
}
