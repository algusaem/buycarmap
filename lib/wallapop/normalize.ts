import { CarListing } from "@/interfaces/listing";
import { WallapopItem } from "@/interfaces/wallapop";
import { getCityCoordinates } from "@/lib/geo/cities";

const WALLAPOP_BASE_URL = "https://es.wallapop.com/item";

const FALLBACK_LAT = 40.4168;
const FALLBACK_LNG = -3.7038;

export function normalizeWallapopItems(
  items: WallapopItem[],
): CarListing[] {
  return items
    .filter((item) => !item.reserved?.flag)
    .map((item): CarListing | null => {
      const hasCoords =
        item.location?.latitude != null && item.location?.longitude != null;
      const city = item.location?.city ?? "";

      let lat: number;
      let lng: number;

      if (hasCoords) {
        lat = item.location.latitude;
        lng = item.location.longitude;
      } else {
        const coords = getCityCoordinates(city, FALLBACK_LAT, FALLBACK_LNG);
        lat = coords.lat;
        lng = coords.lng;
      }

      const image =
        item.images?.[0]?.urls?.big ??
        item.images?.[0]?.urls?.medium ??
        "";
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
