interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  state?: string;
  province?: string;
  county?: string;
}

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: NominatimAddress;
}

export interface GeocodingResult {
  placeId: number;
  displayName: string;
  lat: number;
  lng: number;
}

function buildDisplayName(address: NominatimAddress): string {
  const place =
    address.city ?? address.town ?? address.village ?? address.hamlet ?? address.municipality;

  const region = address.state ?? address.province ?? address.county;

  if (place && region) return `${place}, ${region}`;
  if (place) return place;
  if (region) return region;
  return "";
}

// MAPUI-56: throws on a non-ok response or a request that itself throws
// (a network failure), instead of swallowing either into an empty array —
// "Dónde" has to tell the place search being down apart from Nominatim
// legitimately finding no place. The caller (lib/hooks/useLocationSearch.ts)
// catches it and exposes a `failed` flag the field reads.
export async function searchLocations(
  query: string,
  locale: string = "es",
): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "5",
    countrycodes: "es",
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      "User-Agent": "BuyCarMap/1.0",
      "Accept-Language": locale,
    },
  });

  if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);

  const data: NominatimResult[] = await response.json();

  return data.map((item) => ({
    placeId: item.place_id,
    displayName: buildDisplayName(item.address) || item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
}
