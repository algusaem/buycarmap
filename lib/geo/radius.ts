import { CarListing } from "@/interfaces/listing";
import { SPAIN_CENTER } from "@/lib/geo/cities";
import { SearchInput } from "@/lib/validations/search";

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * MAP-16/MAP-17: with a location chosen, no listing outside the radius — or
 * pinned at the country-centre fallback — reaches the user. Only Wallapop
 * enforces the radius upstream; coches.net and Milanuncios are searched
 * nationwide, so this filter at the merge is what makes the radius a real
 * promise. Without a chosen location it filters nothing.
 */
export function filterByRadius(
  listings: CarListing[],
  params: SearchInput,
): CarListing[] {
  const { latitude, longitude, distanceInKm } = params;
  if (latitude == null || longitude == null || distanceInKm == null) {
    return listings;
  }

  return listings.filter((listing) => {
    // An unresolvable location cannot satisfy a radius filter. Compared
    // exactly, because the fallback is a sentinel rather than a measurement:
    // the point is ~49 km from Madrid, so without this every listing whose
    // city failed to resolve would pass a Madrid search (MAP-17).
    if (listing.lat === SPAIN_CENTER.lat && listing.lng === SPAIN_CENTER.lng) {
      return false;
    }
    return (
      haversineKm(latitude, longitude, listing.lat, listing.lng) <=
      distanceInKm
    );
  });
}
